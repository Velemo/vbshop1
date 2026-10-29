-- Zone VIP membership and secure activation using 10 vb$.
CREATE TABLE IF NOT EXISTS public.vip_memberships (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  activated_at timestamptz NOT NULL DEFAULT now(),
  amount_paid numeric(12,2) NOT NULL DEFAULT 10 CHECK (amount_paid = 10)
);
ALTER TABLE public.vip_memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users can view own VIP membership" ON public.vip_memberships;
CREATE POLICY "users can view own VIP membership" ON public.vip_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.vip_memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_vip()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE current_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Faça login para ativar a Zona VIP';
  END IF;

  IF EXISTS (SELECT 1 FROM public.vip_memberships WHERE user_id = auth.uid()) THEN
    RETURN true;
  END IF;

  SELECT balance INTO current_balance
  FROM public.wallets
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF current_balance IS NULL OR current_balance < 10 THEN
    RAISE EXCEPTION 'Saldo insuficiente: precisas de 10 vb$';
  END IF;

  UPDATE public.wallets
  SET balance = balance - 10, updated_at = now()
  WHERE user_id = auth.uid();

  INSERT INTO public.vip_memberships (user_id, amount_paid)
  VALUES (auth.uid(), 10)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_vip() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_vip() TO authenticated;
