CREATE TABLE public.site_wallet_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 kind text NOT NULL CHECK (kind IN ('product_payment','recharge_created')),
 amount numeric NOT NULL CHECK (amount >= 0 AND amount = round(amount,2)),
 source_id uuid NOT NULL,
 description text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(kind,source_id)
);
GRANT SELECT ON public.site_wallet_entries TO authenticated;
GRANT ALL ON public.site_wallet_entries TO service_role;
ALTER TABLE public.site_wallet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read site wallet" ON public.site_wallet_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
ALTER TABLE public.recharge_codes ADD COLUMN funding_source text NOT NULL DEFAULT 'external' CHECK (funding_source IN ('external','site_wallet'));
INSERT INTO public.site_wallet_entries(kind,amount,source_id,description,created_at) SELECT 'product_payment',paid_vb,id,product_name,created_at FROM public.product_mail WHERE paid_vb >= 0;
CREATE FUNCTION public.site_wallet_record_purchase() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(834122);
 INSERT INTO public.site_wallet_entries(kind,amount,source_id,description,created_at) VALUES ('product_payment',NEW.paid_vb,NEW.id,NEW.product_name,NEW.created_at);
 RETURN NEW;
END $$;
CREATE TRIGGER record_site_product_payment AFTER INSERT ON public.product_mail FOR EACH ROW EXECUTE FUNCTION public.site_wallet_record_purchase();
CREATE FUNCTION public.site_wallet_guard_code() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE available numeric;
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.funding_source='site_wallet' THEN
   IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao ADM'; END IF;
   IF NEW.amount IS NULL OR NEW.amount<=0 OR NEW.amount<>round(NEW.amount,2) THEN RAISE EXCEPTION 'Valor inválido'; END IF;
   IF NEW.redeemed_by IS NOT NULL OR NEW.redeemed_at IS NOT NULL THEN RAISE EXCEPTION 'Código já utilizado'; END IF;
   IF NEW.expires_at IS NOT NULL AND NEW.expires_at<=now() THEN RAISE EXCEPTION 'Validade inválida'; END IF;
   PERFORM pg_advisory_xact_lock(834122);
   SELECT coalesce(sum(CASE WHEN kind='product_payment' THEN amount ELSE -amount END),0) INTO available FROM public.site_wallet_entries;
   IF NEW.amount>available THEN RAISE EXCEPTION 'Saldo insuficiente na Carteira do Site'; END IF;
   INSERT INTO public.site_wallet_entries(kind,amount,source_id,description) VALUES ('recharge_created',NEW.amount,NEW.id,NEW.code);
  END IF;
  RETURN NEW;
 END IF;
 IF OLD.funding_source='site_wallet' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Códigos da carteira não podem ser apagados'; END IF;
  IF NEW.amount IS DISTINCT FROM OLD.amount OR NEW.code IS DISTINCT FROM OLD.code OR NEW.funding_source IS DISTINCT FROM OLD.funding_source OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN RAISE EXCEPTION 'O financiamento deste código não pode ser alterado'; END IF;
  IF OLD.redeemed_by IS NOT NULL AND (NEW.redeemed_by IS DISTINCT FROM OLD.redeemed_by OR NEW.redeemed_at IS DISTINCT FROM OLD.redeemed_at) THEN RAISE EXCEPTION 'Código já utilizado'; END IF;
 ELSIF TG_OP='UPDATE' AND NEW.funding_source IS DISTINCT FROM OLD.funding_source THEN RAISE EXCEPTION 'A origem do código não pode ser alterada';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER site_wallet_funded_code BEFORE INSERT OR UPDATE OR DELETE ON public.recharge_codes FOR EACH ROW EXECUTE FUNCTION public.site_wallet_guard_code();
CREATE FUNCTION public.admin_site_wallet_summary() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE payments numeric; issued numeric; user_balance numeric; p2p_balance numeric; pending numeric;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao ADM'; END IF;
 SELECT coalesce(sum(amount) FILTER(WHERE kind='product_payment'),0), coalesce(sum(amount) FILTER(WHERE kind='recharge_created'),0) INTO payments,issued FROM public.site_wallet_entries;
 SELECT coalesce(sum(balance),0) INTO user_balance FROM public.wallets;
 SELECT coalesce(sum(amount_vb-sold_vb),0) INTO p2p_balance FROM public.p2p_offers WHERE status='active';
 SELECT coalesce(sum(amount),0) INTO pending FROM public.recharge_codes WHERE funding_source='site_wallet' AND redeemed_by IS NULL;
 RETURN jsonb_build_object('balance',payments-issued,'spent',payments,'issued',issued,'p2p',p2p_balance,'circulating',user_balance+p2p_balance,'pending_codes',pending);
END $$;
REVOKE ALL ON FUNCTION public.admin_site_wallet_summary() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_site_wallet_summary() TO authenticated,service_role;
CREATE FUNCTION public.admin_generate_site_recharge(_amount numeric,_expires_at timestamptz DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE generated text;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao ADM'; END IF;
 generated := 'VB-' || upper(replace(gen_random_uuid()::text,'-',''));
 INSERT INTO public.recharge_codes(code,amount,expires_at,funding_source) VALUES(generated,_amount,_expires_at,'site_wallet');
 RETURN generated;
END $$;
REVOKE ALL ON FUNCTION public.admin_generate_site_recharge(numeric,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_generate_site_recharge(numeric,timestamptz) TO authenticated,service_role;
CREATE FUNCTION public.lookup_transfer_recipient(_code text) RETURNS TABLE(user_id uuid,display_name text,user_code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF _code IS NULL OR lower(trim(_code)) !~ '^mv[0-9]{8}$' THEN RAISE EXCEPTION 'ID inválido'; END IF;
 RETURN QUERY SELECT p.user_id,coalesce(nullif(trim(p.display_name),''),nullif(trim(c.full_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(u.raw_user_meta_data->>'name'),'')),p.user_code FROM public.profiles p LEFT JOIN public.user_contacts c ON c.user_id=p.user_id LEFT JOIN auth.users u ON u.id=p.user_id WHERE lower(p.user_code)=lower(trim(_code));
END $$;
REVOKE ALL ON FUNCTION public.lookup_transfer_recipient(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.lookup_transfer_recipient(text) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.site_wallet_record_purchase(),public.site_wallet_guard_code() FROM PUBLIC,anon,authenticated;