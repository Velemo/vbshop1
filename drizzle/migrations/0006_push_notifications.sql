CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subs select" ON public.push_subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own subs insert" ON public.push_subscriptions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own subs delete" ON public.push_subscriptions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL DEFAULT '/',
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_user(_user uuid, _title text, _body text, _url text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notifications(user_id, title, body, url) VALUES (_user, _title, _body, coalesce(_url,'/'));
$$;
CREATE OR REPLACE FUNCTION public.notify_admins(_title text, _body text, _url text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notifications(user_id, title, body, url)
  SELECT user_id, _title, _body, coalesce(_url,'/') FROM public.user_roles WHERE role = 'admin';
$$;

-- dispatch each notification to the push sender
CREATE OR REPLACE FUNCTION public.dispatch_notification()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions' AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://wdogfqacqybdtjenmjnr.supabase.co/functions/v1/send-push',
    body := jsonb_build_object('id', NEW.id),
    headers := '{"Content-Type":"application/json"}'::jsonb);
  RETURN NEW;
EXCEPTION WHEN others THEN RETURN NEW;
END $$;
CREATE TRIGGER notifications_dispatch AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.dispatch_notification();

CREATE OR REPLACE FUNCTION public.trg_notify_product_mail() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id, 'Compra concluída ✅', 'O seu produto "' || NEW.product_name || '" foi entregue no Correio.', '/correio');
  RETURN NEW;
END $$;
CREATE TRIGGER product_mail_notify AFTER INSERT ON public.product_mail FOR EACH ROW EXECUTE FUNCTION public.trg_notify_product_mail();

CREATE OR REPLACE FUNCTION public.trg_notify_prize_mail() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.notify_user(NEW.user_id, 'Prémio da roleta 🎉', 'Ganhou: ' || coalesce(nullif(NEW.label,''),'um prémio') || '. Veja no Correio.', '/correio');
  RETURN NEW;
END $$;
CREATE TRIGGER prize_mail_notify AFTER INSERT ON public.prize_mail FOR EACH ROW EXECUTE FUNCTION public.trg_notify_prize_mail();

CREATE OR REPLACE FUNCTION public.trg_notify_chat() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind <> 'text' THEN RETURN NEW; END IF;
  IF NEW.from_admin THEN
    PERFORM public.notify_user(NEW.user_id, 'Nova mensagem do ADM', left(NEW.body, 140), '/pedidos');
  ELSE
    PERFORM public.notify_admins('Nova mensagem de utilizador', left(NEW.body, 140), '/pedidos');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER chat_messages_notify AFTER INSERT ON public.chat_messages FOR EACH ROW EXECUTE FUNCTION public.trg_notify_chat();

CREATE OR REPLACE FUNCTION public.trg_notify_p2p() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE amt text := NEW.amount_vb || ' vb$ (' || NEW.total_mt || ' MT)';
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_user(NEW.seller_id, 'Novo pedido de moedas P2P', NEW.buyer_name || ' quer comprar ' || amt, '/pedidos');
    RETURN NEW;
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'receipt_sent' THEN
    PERFORM public.notify_user(NEW.seller_id, 'Comprovativo recebido', 'Verifique o pagamento de ' || amt, '/pedidos');
  ELSIF NEW.status = 'confirmed' THEN
    PERFORM public.notify_user(NEW.buyer_id, 'Pedido P2P aprovado ✅', amt || ' foram creditados no seu saldo.', '/pedidos');
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.notify_user(NEW.buyer_id, 'Comprovativo recusado', 'O seu comprovativo de ' || amt || ' foi recusado.', '/pedidos');
  ELSIF NEW.status = 'disputed' THEN
    PERFORM public.notify_admins('Nova arbitragem ⚠️', 'Disputa aberta: ' || amt, '/pedidos');
    PERFORM public.notify_user(CASE WHEN NEW.buyer_id = auth.uid() THEN NEW.seller_id ELSE NEW.buyer_id END, 'Negociação em disputa', 'Foi aberta uma arbitragem sobre ' || amt, '/pedidos');
  ELSIF NEW.status = 'cancelled' THEN
    PERFORM public.notify_user(NEW.seller_id, 'Pedido P2P cancelado', amt, '/pedidos');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER p2p_orders_notify AFTER INSERT OR UPDATE OF status ON public.p2p_orders FOR EACH ROW EXECUTE FUNCTION public.trg_notify_p2p();

REVOKE EXECUTE ON FUNCTION public.notify_user(uuid,text,text,text), public.notify_admins(text,text,text), public.dispatch_notification(), public.trg_notify_product_mail(), public.trg_notify_prize_mail(), public.trg_notify_chat(), public.trg_notify_p2p() FROM PUBLIC, anon, authenticated;