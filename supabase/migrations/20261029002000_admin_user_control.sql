-- Admin user control: secure account directory and per-user activity history.
CREATE TABLE IF NOT EXISTS public.vb_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.vb_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users see own vb transactions" ON public.vb_transactions;
CREATE POLICY "users see own vb transactions" ON public.vb_transactions
  FOR SELECT TO authenticated USING (sender_id = auth.uid() OR recipient_id = auth.uid());
GRANT SELECT ON public.vb_transactions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  user_id uuid, email text, account_created_at timestamptz,
  user_code text, display_name text, balance numeric, tickets integer
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso reservado ao administrador';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, u.created_at, p.user_code, p.display_name,
         COALESCE(w.balance, 0)::numeric, COALESCE(w.tickets, 0)::integer
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.wallets w ON w.user_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_user_history(_user_id uuid)
RETURNS TABLE (event_type text, description text, amount numeric, event_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso reservado ao administrador';
  END IF;
  RETURN QUERY
    SELECT 'Compra'::text, pm.product_name::text, pm.paid_vb::numeric, pm.created_at
    FROM public.product_mail pm WHERE pm.user_id = _user_id
    UNION ALL
    SELECT 'Roleta'::text, ('Prémio: ' || rs.label)::text, NULL::numeric, rs.created_at
    FROM public.roulette_spins rs WHERE rs.user_id = _user_id
    UNION ALL
    SELECT 'Recarga vb$'::text, ('Código: ' || rc.code)::text, rc.amount::numeric, rc.created_at
    FROM public.recharge_codes rc WHERE rc.redeemed_by = _user_id
    UNION ALL
    SELECT 'Envio vb$'::text, ('Enviado para ' || COALESCE(rp.user_code, vt.recipient_id::text))::text, -vt.amount, vt.created_at
    FROM public.vb_transactions vt LEFT JOIN public.profiles rp ON rp.user_id = vt.recipient_id
    WHERE vt.sender_id = _user_id
    UNION ALL
    SELECT 'Recebimento vb$'::text, ('Recebido de ' || COALESCE(sp.user_code, vt.sender_id::text))::text, vt.amount, vt.created_at
    FROM public.vb_transactions vt LEFT JOIN public.profiles sp ON sp.user_id = vt.sender_id
    WHERE vt.recipient_id = _user_id
    UNION ALL
    SELECT 'P2P'::text, ('Ordem P2P: ' || po.status)::text, NULL::numeric, po.created_at
    FROM public.p2p_orders po WHERE po.buyer_id = _user_id
    ORDER BY event_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_user_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_history(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.transfer_vb(_recipient_user_id uuid,_amount numeric) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sender_balance numeric; recipient_balance numeric;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para enviar vb$'; END IF;
 IF _recipient_user_id IS NULL OR _recipient_user_id=auth.uid() THEN RAISE EXCEPTION 'Destinatário inválido'; END IF;
 IF _amount IS NULL OR _amount<=0 OR _amount>100000000 THEN RAISE EXCEPTION 'Valor inválido'; END IF;
 PERFORM 1 FROM public.wallets WHERE user_id IN(auth.uid(),_recipient_user_id) ORDER BY user_id FOR UPDATE;
 SELECT balance INTO sender_balance FROM public.wallets WHERE user_id=auth.uid();
 IF sender_balance IS NULL OR sender_balance<_amount THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=_recipient_user_id) THEN RAISE EXCEPTION 'Destinatário não encontrado'; END IF;
 INSERT INTO public.wallets(user_id,balance) VALUES(_recipient_user_id,0) ON CONFLICT(user_id) DO NOTHING;
 UPDATE public.wallets SET balance=balance-_amount,updated_at=now() WHERE user_id=auth.uid();
 UPDATE public.wallets SET balance=balance+_amount,updated_at=now() WHERE user_id=_recipient_user_id RETURNING balance INTO recipient_balance;
 INSERT INTO public.vb_transactions(sender_id, recipient_id, amount) VALUES(auth.uid(), _recipient_user_id, _amount);
 RETURN recipient_balance;
END $$;
REVOKE EXECUTE ON FUNCTION public.transfer_vb(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_vb(uuid,numeric) TO authenticated;
