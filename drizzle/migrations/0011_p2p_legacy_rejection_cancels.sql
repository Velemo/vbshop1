CREATE OR REPLACE FUNCTION public.p2p_reject_order(_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE o public.p2p_orders;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 SELECT * INTO o FROM public.p2p_orders WHERE id=_order_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
 IF o.seller_id <> auth.uid() AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Apenas o vendedor ou ADM pode cancelar.' USING ERRCODE='42501'; END IF;
 PERFORM public.p2p_cancel_order(_order_id);
END $$;
COMMENT ON FUNCTION public.p2p_reject_order(uuid) IS 'Compatibility entry point: seller rejection now cancels and releases the reservation through p2p_cancel_order.';