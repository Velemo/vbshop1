CREATE OR REPLACE FUNCTION public.redeem_code(_code text) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.recharge_codes; nb numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO c FROM recharge_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF c.redeemed_by IS NOT NULL THEN RAISE EXCEPTION 'Código já usado'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at < now() THEN RAISE EXCEPTION 'Código expirado'; END IF;
  UPDATE recharge_codes SET redeemed_by = auth.uid(), redeemed_at = now() WHERE id = c.id;
  INSERT INTO wallets(user_id, balance) VALUES (auth.uid(), c.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + c.amount, updated_at = now()
    RETURNING balance INTO nb;
  RETURN nb;
END $$;