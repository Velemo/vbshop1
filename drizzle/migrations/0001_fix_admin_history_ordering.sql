CREATE OR REPLACE FUNCTION public.admin_user_history(_user_id uuid)
RETURNS TABLE(event_type text,description text,amount numeric,event_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
 RETURN QUERY
 SELECT 'Compra'::text,pm.product_name::text,-pm.paid_vb,pm.created_at FROM public.product_mail pm WHERE pm.user_id=_user_id
 UNION ALL SELECT 'Depósito'::text,'Recarga resgatada'::text,rc.amount,rc.redeemed_at FROM public.recharge_codes rc WHERE rc.redeemed_by=_user_id AND rc.redeemed_at IS NOT NULL
 UNION ALL SELECT 'Envio vb$'::text,('Enviado para '||COALESCE(rp.user_code,'Conta removida'))::text,-vt.amount,vt.created_at FROM public.vb_transfers vt LEFT JOIN public.profiles rp ON rp.user_id=vt.recipient_user_id WHERE vt.sender_user_id=_user_id
 UNION ALL SELECT 'Recebimento vb$'::text,('Recebido de '||COALESCE(sp.user_code,'Conta removida'))::text,vt.amount,vt.created_at FROM public.vb_transfers vt LEFT JOIN public.profiles sp ON sp.user_id=vt.sender_user_id WHERE vt.recipient_user_id=_user_id
 ORDER BY 4 DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_user_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_history(uuid) TO authenticated;