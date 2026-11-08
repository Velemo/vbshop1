CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE INDEX IF NOT EXISTS p2p_orders_buyer_created_idx ON public.p2p_orders (buyer_id, created_at);
CREATE INDEX IF NOT EXISTS p2p_orders_pending_created_idx ON public.p2p_orders (created_at) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.p2p_expire_unpaid_orders(_participant uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.p2p_orders; expired integer := 0;
BEGIN
  FOR o IN SELECT * FROM public.p2p_orders
    WHERE status = 'pending' AND created_at <= clock_timestamp() - interval '15 minutes'
      AND (_participant IS NULL OR buyer_id = _participant OR seller_id = _participant)
    ORDER BY created_at FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.p2p_orders SET status = 'cancelled' WHERE id = o.id;
    UPDATE public.p2p_offers SET reserved_vb = greatest(reserved_vb - o.amount_vb, 0) WHERE id = o.offer_id;
    expired := expired + 1;
  END LOOP;
  RETURN expired;
END $$;
REVOKE ALL ON FUNCTION public.p2p_expire_unpaid_orders(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.p2p_expire_unpaid_orders(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.p2p_purchase_status()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); day_start timestamptz; used integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Faça login' USING ERRCODE = '42501'; END IF;
  PERFORM public.p2p_expire_unpaid_orders(uid);
  day_start := date_trunc('day', clock_timestamp() AT TIME ZONE 'Africa/Maputo') AT TIME ZONE 'Africa/Maputo';
  SELECT count(*) INTO used FROM public.p2p_orders WHERE buyer_id = uid AND created_at >= day_start AND created_at < day_start + interval '1 day';
  RETURN jsonb_build_object('used', used, 'remaining', greatest(5 - used, 0), 'resets_at', day_start + interval '1 day', 'server_now', clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION public.p2p_purchase_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.p2p_purchase_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.p2p_create_order(_offer_id uuid, _amount_vb numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_buyer uuid := auth.uid(); o public.p2p_offers; v_available numeric(14,2); v_name text; v_order uuid; v_min_buy numeric; day_start timestamptz;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('p2p-buyer:' || v_buyer::text, 0));
  PERFORM public.p2p_expire_unpaid_orders(v_buyer);
  day_start := date_trunc('day', clock_timestamp() AT TIME ZONE 'Africa/Maputo') AT TIME ZONE 'Africa/Maputo';
  IF (SELECT count(*) FROM public.p2p_orders WHERE buyer_id = v_buyer AND created_at >= day_start AND created_at < day_start + interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'Atingiu o limite de 5 pedidos P2P hoje. Tente novamente amanhã (hora de Maputo).';
  END IF;
  IF EXISTS (SELECT 1 FROM public.p2p_orders WHERE buyer_id = v_buyer AND status IN ('pending','receipt_sent','rejected','disputed')) THEN
    RAISE EXCEPTION 'Já tem um pedido ativo. Conclua ou cancele o pedido em Pedidos antes de comprar novamente.';
  END IF;
  IF _amount_vb IS NULL OR _amount_vb <= 0 OR _amount_vb <> round(_amount_vb, 2) THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  SELECT min_buy_vb INTO v_min_buy FROM public.p2p_settings WHERE id = 1;
  IF coalesce(v_min_buy, 0) > 0 AND _amount_vb < v_min_buy THEN RAISE EXCEPTION 'A compra mínima é de % vb$.', trim(to_char(v_min_buy, 'FM999999990.00')); END IF;
  SELECT * INTO o FROM public.p2p_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'active' THEN RAISE EXCEPTION 'Oferta indisponível.'; END IF;
  IF o.seller_id = v_buyer THEN RAISE EXCEPTION 'Não pode comprar a sua própria oferta.'; END IF;
  v_available := o.amount_vb - o.sold_vb - o.reserved_vb;
  IF _amount_vb > v_available THEN RAISE EXCEPTION 'Quantidade indisponível nesta oferta.'; END IF;
  SELECT coalesce(nullif(display_name, ''), 'Comprador') INTO v_name FROM public.profiles WHERE user_id = v_buyer;
  INSERT INTO public.p2p_orders(offer_id, buyer_id, buyer_name, seller_id, amount_vb, price_per_vb, total_mt, created_at)
  VALUES (_offer_id, v_buyer, coalesce(v_name, 'Comprador'), o.seller_id, _amount_vb, o.price_per_vb, round(_amount_vb * o.price_per_vb, 2), clock_timestamp()) RETURNING id INTO v_order;
  UPDATE public.p2p_offers SET reserved_vb = reserved_vb + _amount_vb WHERE id = _offer_id;
  RETURN v_order;
END $$;

CREATE OR REPLACE FUNCTION public.p2p_submit_receipt(_order_id uuid, _note text, _image_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE o public.p2p_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO o FROM public.p2p_orders WHERE id = _order_id AND buyer_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF o.status NOT IN ('pending','rejected') THEN RAISE EXCEPTION 'Este pedido já não aceita comprovativo.'; END IF;
  IF o.status = 'pending' AND clock_timestamp() >= o.created_at + interval '15 minutes' THEN
    RAISE EXCEPTION 'O prazo de 15 minutos terminou. Este pedido expirou e já não aceita comprovativo.';
  END IF;
  IF coalesce(trim(_note), '') = '' AND coalesce(trim(_image_url), '') = '' THEN RAISE EXCEPTION 'Escreva uma nota ou envie a imagem do comprovativo.'; END IF;
  UPDATE public.p2p_orders SET status = 'receipt_sent', receipt_note = nullif(trim(_note), ''), receipt_image_url = nullif(trim(_image_url), '') WHERE id = _order_id;
END $$;