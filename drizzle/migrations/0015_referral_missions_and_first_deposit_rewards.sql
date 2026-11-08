CREATE TABLE public.referral_accounts (
 user_id uuid PRIMARY KEY, code text NOT NULL UNIQUE CHECK (code ~ '^MV[0-9]{3}[A-Z][0-9]$'), pending_balance numeric NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.referral_accounts TO authenticated;
GRANT ALL ON public.referral_accounts TO service_role;
ALTER TABLE public.referral_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_account_owner ON public.referral_accounts FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.referral_links (
 invitee_id uuid PRIMARY KEY, referrer_id uuid NOT NULL, linked_at timestamptz NOT NULL DEFAULT now(), rewarded_at timestamptz, CHECK (invitee_id <> referrer_id)
);
GRANT SELECT ON public.referral_links TO authenticated;
GRANT ALL ON public.referral_links TO service_role;
ALTER TABLE public.referral_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_link_owner ON public.referral_links FOR SELECT TO authenticated USING (invitee_id = auth.uid() OR referrer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.referral_movements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, kind text NOT NULL CHECK (kind IN ('invitee_bonus','referrer_bonus','withdrawal')), amount numeric NOT NULL, invitee_id uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (kind, invitee_id)
);
GRANT SELECT ON public.referral_movements TO authenticated;
GRANT ALL ON public.referral_movements TO service_role;
ALTER TABLE public.referral_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_movement_owner ON public.referral_movements FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TABLE public.referral_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK(id=1), message text NOT NULL DEFAULT 'Conheça a MARCHA vb: {SITE}\nCanal WhatsApp: {CANAL}', channel_url text NOT NULL DEFAULT 'https://whatsapp.com/channel/0029VbBl40G6BIEnrgYGsl2Z', updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.referral_settings TO authenticated;
GRANT ALL ON public.referral_settings TO service_role;
ALTER TABLE public.referral_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY referral_settings_read ON public.referral_settings FOR SELECT TO authenticated USING(true);
CREATE POLICY referral_settings_write ON public.referral_settings FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.referral_dashboard() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); account public.referral_accounts; generated text; born timestamptz; deadline timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Faça login' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-user:'||uid::text,0));
 SELECT * INTO account FROM public.referral_accounts WHERE user_id=uid;
 IF NOT FOUND THEN
  LOOP
   generated:='MV'||lpad(floor(random()*1000)::int::text,3,'0')||chr(65+floor(random()*26)::int)||floor(random()*10)::int::text;
   INSERT INTO public.referral_accounts(user_id,code) VALUES(uid,generated) ON CONFLICT(code) DO NOTHING RETURNING * INTO account;
   EXIT WHEN FOUND;
  END LOOP;
 END IF;
 SELECT created_at INTO born FROM auth.users WHERE id=uid;
 deadline:=born+interval '15 minutes';
 RETURN jsonb_build_object('code',account.code,'pending_balance',account.pending_balance,'invited',(SELECT count(*) FROM public.referral_links WHERE referrer_id=uid),'qualified',(SELECT count(*) FROM public.referral_links WHERE referrer_id=uid AND rewarded_at IS NOT NULL),
 'can_link',clock_timestamp()<deadline AND NOT EXISTS(SELECT 1 FROM public.referral_links WHERE invitee_id=uid) AND NOT EXISTS(SELECT 1 FROM public.recharge_codes WHERE redeemed_by=uid) AND NOT EXISTS(SELECT 1 FROM public.p2p_orders WHERE buyer_id=uid AND status='confirmed'),
 'deadline',deadline,'server_now',clock_timestamp(),'settings',coalesce((SELECT to_jsonb(s) FROM public.referral_settings s WHERE id=1),jsonb_build_object('message',E'Conheça a MARCHA vb: {SITE}\nCanal WhatsApp: {CANAL}','channel_url','https://whatsapp.com/channel/0029VbBl40G6BIEnrgYGsl2Z')),
 'movements',coalesce((SELECT jsonb_agg(x) FROM (SELECT kind,amount,created_at FROM public.referral_movements WHERE user_id=uid ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb));
END $$;
CREATE FUNCTION public.referral_link(_code text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); inviter uuid; born timestamptz;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Faça login' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-user:'||uid::text,0));
 SELECT created_at INTO born FROM auth.users WHERE id=uid;
 IF clock_timestamp()>=born+interval '15 minutes' THEN RAISE EXCEPTION 'O prazo de 15 minutos para indicar a referência terminou.'; END IF;
 IF EXISTS(SELECT 1 FROM public.referral_links WHERE invitee_id=uid) THEN RAISE EXCEPTION 'Esta conta já tem uma referência.'; END IF;
 IF EXISTS(SELECT 1 FROM public.recharge_codes WHERE redeemed_by=uid) OR EXISTS(SELECT 1 FROM public.p2p_orders WHERE buyer_id=uid AND status='confirmed') THEN RAISE EXCEPTION 'A referência deve ser registada antes do primeiro depósito.'; END IF;
 SELECT user_id INTO inviter FROM public.referral_accounts WHERE code=upper(trim(_code));
 IF inviter IS NULL THEN RAISE EXCEPTION 'Código de partilha inválido.'; END IF;
 IF inviter=uid THEN RAISE EXCEPTION 'Não pode indicar a própria conta.'; END IF;
 INSERT INTO public.referral_links(invitee_id,referrer_id) VALUES(uid,inviter);
END $$;
CREATE FUNCTION public.referral_reward_first_deposit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; link public.referral_links;
BEGIN
 IF TG_TABLE_NAME='recharge_codes' THEN
  IF NEW.redeemed_by IS NULL OR OLD.redeemed_by IS NOT NULL OR NEW.amount<=0 THEN RETURN NEW; END IF;
  uid:=NEW.redeemed_by;
 ELSE
  IF NEW.status<>'confirmed' OR OLD.status='confirmed' OR NEW.amount_vb<=0 THEN RETURN NEW; END IF;
  uid:=NEW.buyer_id;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('referral-user:'||uid::text,0));
 SELECT * INTO link FROM public.referral_links WHERE invitee_id=uid FOR UPDATE;
 IF NOT FOUND OR link.rewarded_at IS NOT NULL THEN RETURN NEW; END IF;
 UPDATE public.referral_links SET rewarded_at=clock_timestamp() WHERE invitee_id=uid;
 INSERT INTO public.referral_movements(user_id,kind,amount,invitee_id) VALUES(uid,'invitee_bonus',0.10,uid),(link.referrer_id,'referrer_bonus',0.11,uid);
 INSERT INTO public.wallets(user_id,balance) VALUES(uid,0.10) ON CONFLICT(user_id) DO UPDATE SET balance=public.wallets.balance+0.10,updated_at=now();
 UPDATE public.referral_accounts SET pending_balance=pending_balance+0.11 WHERE user_id=link.referrer_id;
 RETURN NEW;
END $$;
CREATE TRIGGER referral_recharge_bonus AFTER UPDATE OF redeemed_by ON public.recharge_codes FOR EACH ROW EXECUTE FUNCTION public.referral_reward_first_deposit();
CREATE TRIGGER referral_p2p_bonus AFTER UPDATE OF status ON public.p2p_orders FOR EACH ROW EXECUTE FUNCTION public.referral_reward_first_deposit();
CREATE FUNCTION public.referral_withdraw() RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); amount numeric;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Faça login' USING ERRCODE='42501'; END IF;
 SELECT pending_balance INTO amount FROM public.referral_accounts WHERE user_id=uid FOR UPDATE;
 IF amount IS NULL OR amount<2 THEN RAISE EXCEPTION 'Precisa de pelo menos 2 vb$ no saldo de partilha para resgatar.'; END IF;
 UPDATE public.referral_accounts SET pending_balance=0 WHERE user_id=uid;
 INSERT INTO public.wallets(user_id,balance) VALUES(uid,amount) ON CONFLICT(user_id) DO UPDATE SET balance=public.wallets.balance+amount,updated_at=now();
 INSERT INTO public.referral_movements(user_id,kind,amount) VALUES(uid,'withdrawal',amount);
 RETURN amount;
END $$;
CREATE FUNCTION public.admin_referral_dashboard() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao ADM' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('accounts',coalesce((SELECT jsonb_agg(x) FROM (SELECT a.code,coalesce(p.display_name,'Utilizador') AS name,p.user_code,a.pending_balance,(SELECT count(*) FROM public.referral_links l WHERE l.referrer_id=a.user_id) AS invited,(SELECT count(*) FROM public.referral_links l WHERE l.referrer_id=a.user_id AND l.rewarded_at IS NOT NULL) AS qualified FROM public.referral_accounts a LEFT JOIN public.profiles p ON p.user_id=a.user_id ORDER BY a.created_at DESC) x),'[]'::jsonb),
 'links',coalesce((SELECT jsonb_agg(x) FROM (SELECT coalesce(p.display_name,'Utilizador') AS invitee_name,p.user_code,a.code AS referrer_code,l.linked_at,l.rewarded_at FROM public.referral_links l JOIN public.referral_accounts a ON a.user_id=l.referrer_id LEFT JOIN public.profiles p ON p.user_id=l.invitee_id ORDER BY l.linked_at DESC LIMIT 500) x),'[]'::jsonb),
 'movements',coalesce((SELECT jsonb_agg(x) FROM (SELECT coalesce(p.display_name,'Utilizador') AS name,p.user_code,m.kind,m.amount,m.created_at FROM public.referral_movements m LEFT JOIN public.profiles p ON p.user_id=m.user_id ORDER BY m.created_at DESC LIMIT 500) x),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.referral_dashboard(),public.referral_link(text),public.referral_withdraw(),public.admin_referral_dashboard() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.referral_dashboard(),public.referral_link(text),public.referral_withdraw(),public.admin_referral_dashboard() TO authenticated;
REVOKE ALL ON FUNCTION public.referral_reward_first_deposit() FROM PUBLIC,anon,authenticated;