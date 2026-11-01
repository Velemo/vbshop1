CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (user_id uuid, email text, account_created_at timestamptz, user_code text, display_name text, avatar_url text, balance numeric, tickets integer, is_banned boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.email::text,u.created_at,p.user_code,COALESCE(NULLIF(p.display_name,''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),COALESCE(NULLIF(p.avatar_url,''),u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture'),COALESCE(w.balance,0)::numeric,COALESCE(w.tickets,0)::integer,COALESCE(u.banned_until>now(),false)
 FROM auth.users u LEFT JOIN public.profiles p ON p.user_id=u.id LEFT JOIN public.wallets w ON w.user_id=u.id ORDER BY u.created_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

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
 ORDER BY event_at DESC;
END; $$;
REVOKE ALL ON FUNCTION public.admin_user_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_user_history(uuid) TO authenticated;

-- Runs for every Data API request, including already-issued JWTs and financial RPCs.
CREATE OR REPLACE FUNCTION public.check_account_access() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users u WHERE u.id=auth.uid() AND u.banned_until>now()) THEN
  RAISE EXCEPTION 'Conta banida. Contacte o administrador.' USING ERRCODE='42501';
 END IF;
END; $$;
REVOKE ALL ON FUNCTION public.check_account_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_account_access() TO anon,authenticated,service_role;
ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.check_account_access';
NOTIFY pgrst, 'reload config';