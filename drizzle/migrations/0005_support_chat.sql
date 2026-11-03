CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_id uuid,
  from_admin boolean NOT NULL DEFAULT false,
  kind text NOT NULL DEFAULT 'text',
  body text NOT NULL,
  order_id uuid REFERENCES public.p2p_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_idx ON public.chat_messages(user_id, created_at);
GRANT SELECT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or admin read chat" ON public.chat_messages FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

CREATE OR REPLACE FUNCTION public.chat_send(_user_id uuid, _body text, _order_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE adm boolean; target uuid; v uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  IF coalesce(trim(_body),'') = '' THEN RAISE EXCEPTION 'Mensagem vazia'; END IF;
  IF length(_body) > 2000 THEN RAISE EXCEPTION 'Mensagem demasiado longa'; END IF;
  adm := public.has_role(auth.uid(), 'admin');
  target := CASE WHEN adm AND _user_id IS NOT NULL THEN _user_id ELSE auth.uid() END;
  IF _order_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.p2p_orders o WHERE o.id=_order_id AND (o.buyer_id=target OR o.seller_id=target)) THEN
    RAISE EXCEPTION 'Pedido inválido';
  END IF;
  INSERT INTO public.chat_messages(user_id, sender_id, from_admin, body, order_id)
  VALUES (target, auth.uid(), adm AND target <> auth.uid(), trim(_body), _order_id) RETURNING id INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.admin_chat_threads()
RETURNS TABLE(user_id uuid, display_name text, avatar_url text, user_code text, vip boolean, last_body text, last_at timestamptz, last_from_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (m.user_id) m.user_id, coalesce(nullif(p.display_name,''),'Utilizador'), nullif(p.avatar_url,''), p.user_code,
    public.is_vip(m.user_id), m.body, m.created_at, m.from_admin
  FROM public.chat_messages m LEFT JOIN public.profiles p ON p.user_id = m.user_id
  ORDER BY m.user_id, m.created_at DESC;
END $$;

-- Admin may also reject receipts
CREATE OR REPLACE FUNCTION public.p2p_reject_order(_order_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.seller_id <> auth.uid() and not public.has_role(auth.uid(),'admin') then raise exception 'Apenas o vendedor pode recusar.'; end if;
  if o.status <> 'receipt_sent' then raise exception 'Este pedido não tem comprovativo para recusar.'; end if;
  update public.p2p_orders set status = 'rejected' where id = o.id;
end $function$;

-- Log every order status change into both participants' chats
CREATE OR REPLACE FUNCTION public.chat_log_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE lbl text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status THEN RETURN NEW; END IF;
  lbl := CASE NEW.status WHEN 'pending' THEN 'Pedido criado' WHEN 'receipt_sent' THEN 'Comprovativo enviado'
    WHEN 'rejected' THEN 'Comprovativo recusado' WHEN 'confirmed' THEN 'Pagamento confirmado, vb$ libertados'
    WHEN 'disputed' THEN 'Disputa aberta' WHEN 'cancelled' THEN 'Pedido cancelado' ELSE NEW.status END;
  INSERT INTO public.chat_messages(user_id, sender_id, from_admin, kind, body, order_id)
  SELECT u, NULL, true, 'status', lbl || ' · ' || NEW.amount_vb || ' vb$ (' || NEW.total_mt || ' MT)', NEW.id
  FROM (SELECT NEW.buyer_id AS u UNION SELECT NEW.seller_id) s;
  RETURN NEW;
END $$;
CREATE TRIGGER p2p_orders_chat_log AFTER INSERT OR UPDATE OF status ON public.p2p_orders
FOR EACH ROW EXECUTE FUNCTION public.chat_log_order_status();
REVOKE EXECUTE ON FUNCTION public.chat_log_order_status() FROM PUBLIC, anon, authenticated;