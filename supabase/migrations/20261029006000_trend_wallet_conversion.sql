-- Separate Trend trading wallet and atomic conversion from the site's vb$ wallet.
CREATE TABLE IF NOT EXISTS public.trend_wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trend_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own Trend wallet" ON public.trend_wallets;
CREATE POLICY "Users can view own Trend wallet" ON public.trend_wallets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
GRANT SELECT ON public.trend_wallets TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_vb_to_trend(_amount numeric)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE site_balance numeric; trend_balance numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para converter vb$'; END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 100000000 THEN
    RAISE EXCEPTION 'Quantidade de conversão inválida';
  END IF;
  INSERT INTO public.wallets(user_id, balance) VALUES(auth.uid(), 0)
  ON CONFLICT(user_id) DO NOTHING;
  INSERT INTO public.trend_wallets(user_id, balance) VALUES(auth.uid(), 0)
  ON CONFLICT(user_id) DO NOTHING;
  PERFORM 1 FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  SELECT balance INTO site_balance FROM public.wallets WHERE user_id = auth.uid();
  IF site_balance IS NULL OR site_balance < _amount THEN
    RAISE EXCEPTION 'Saldo vb$ insuficiente na carteira do site';
  END IF;
  UPDATE public.wallets SET balance = balance - _amount, updated_at = now()
    WHERE user_id = auth.uid();
  UPDATE public.trend_wallets SET balance = balance + _amount, updated_at = now()
    WHERE user_id = auth.uid() RETURNING balance INTO trend_balance;
  RETURN trend_balance;
END;
$$;
REVOKE ALL ON FUNCTION public.convert_vb_to_trend(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_vb_to_trend(numeric) TO authenticated;
