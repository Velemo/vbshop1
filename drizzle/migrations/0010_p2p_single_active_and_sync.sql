CREATE UNIQUE INDEX IF NOT EXISTS p2p_one_active_buyer ON public.p2p_orders (buyer_id) WHERE status IN ('pending','receipt_sent','rejected','disputed');
CREATE OR REPLACE FUNCTION public.p2p_create_order(_offer_id uuid, _amount_vb numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_buyer uuid := auth.uid(); o public.p2p_offers; v_available numeric(14,2); v_name text; v_order uuid;
BEGIN
 IF v_buyer IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('p2p-buyer:' || v_buyer::text, 0));
 IF EXISTS (SELECT 1 FROM public.p2p_orders WHERE buyer_id=v_buyer AND status IN ('pending','receipt_sent','rejected','disputed')) THEN
  RAISE EXCEPTION 'Já tem um pedido ativo. Conclua ou cancele o pedido em Pedidos antes de comprar novamente.';
 END IF;
 IF _amount_vb IS NULL OR _amount_vb <= 0 OR _amount_vb <> round(_amount_vb,2) THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
 SELECT * INTO o FROM public.p2p_offers WHERE id=_offer_id FOR UPDATE;
 IF NOT FOUND OR o.status <> 'active' THEN RAISE EXCEPTION 'Oferta indisponível.'; END IF;
 IF o.seller_id=v_buyer THEN RAISE EXCEPTION 'Não pode comprar a sua própria oferta.'; END IF;
 v_available := o.amount_vb-o.sold_vb-o.reserved_vb;
 IF _amount_vb>v_available THEN RAISE EXCEPTION 'Quantidade indisponível nesta oferta.'; END IF;
 SELECT coalesce(nullif(display_name,''),'Comprador') INTO v_name FROM public.profiles WHERE user_id=v_buyer;
 INSERT INTO public.p2p_orders(offer_id,buyer_id,buyer_name,seller_id,amount_vb,price_per_vb,total_mt)
 VALUES(_offer_id,v_buyer,coalesce(v_name,'Comprador'),o.seller_id,_amount_vb,o.price_per_vb,round(_amount_vb*o.price_per_vb,2)) RETURNING id INTO v_order;
 UPDATE public.p2p_offers SET reserved_vb=reserved_vb+_amount_vb WHERE id=_offer_id;
 RETURN v_order;
END $$;
CREATE OR REPLACE FUNCTION public.p2p_cancel_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o public.p2p_orders;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 SELECT * INTO o FROM public.p2p_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF o.buyer_id <> auth.uid() AND o.seller_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado aos participantes.' USING ERRCODE='42501'; END IF;
 IF o.status NOT IN ('pending','receipt_sent','rejected') THEN RAISE EXCEPTION 'Este pedido já não pode ser cancelado. Disputas devem ser resolvidas pelo ADM.'; END IF;
 IF o.buyer_id=auth.uid() AND o.seller_id<>auth.uid() AND NOT public.has_role(auth.uid(),'admin') AND o.status <> 'pending' THEN RAISE EXCEPTION 'Após enviar o comprovativo, o cancelamento cabe ao vendedor ou ADM.'; END IF;
 UPDATE public.p2p_orders SET status='cancelled' WHERE id=o.id;
 UPDATE public.p2p_offers SET reserved_vb=greatest(reserved_vb-o.amount_vb,0) WHERE id=o.offer_id;
END $$;
CREATE OR REPLACE FUNCTION public.chat_log_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE lbl text;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 lbl := CASE NEW.status WHEN 'pending' THEN 'Pedido criado' WHEN 'receipt_sent' THEN 'Comprovativo enviado'
 WHEN 'rejected' THEN 'Comprovativo recusado' WHEN 'confirmed' THEN 'Pagamento confirmado, vb$ libertados'
 WHEN 'disputed' THEN 'Disputa aberta' WHEN 'cancelled' THEN 'Pedido cancelado' ELSE NEW.status END;
 INSERT INTO public.chat_messages(user_id,sender_id,from_admin,kind,body,order_id)
 SELECT u,NULL,true,'status',lbl || ' · ' || NEW.amount_vb || ' vb$ (' || NEW.total_mt || ' MT)' ||
 CASE WHEN NEW.status='receipt_sent' THEN E'\nComprador: ' || NEW.buyer_name ||
 CASE WHEN NEW.receipt_note IS NOT NULL THEN E'\nNota: ' || NEW.receipt_note ELSE '' END ELSE '' END,NEW.id
 FROM (SELECT NEW.buyer_id AS u UNION SELECT NEW.seller_id) s;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='p2p_orders') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_orders; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='p2p_offers') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.p2p_offers; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='wallets') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets; END IF;
END $$;