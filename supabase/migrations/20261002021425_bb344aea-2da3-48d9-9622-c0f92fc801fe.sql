CREATE TABLE public.roulette_slots (
  position int PRIMARY KEY CHECK (position BETWEEN 0 AND 9),
  image_url text,
  label text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roulette_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.roulette_slots TO authenticated;
GRANT ALL ON public.roulette_slots TO service_role;
ALTER TABLE public.roulette_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone view slots" ON public.roulette_slots FOR SELECT USING (true);
CREATE POLICY "admins manage slots" ON public.roulette_slots FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
INSERT INTO public.roulette_slots(position) SELECT g FROM generate_series(0,9) g;

CREATE TABLE public.wallets (
  user_id uuid PRIMARY KEY,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  tickets int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallet" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE TABLE public.recharge_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  redeemed_by uuid,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.recharge_codes TO authenticated;
GRANT ALL ON public.recharge_codes TO service_role;
ALTER TABLE public.recharge_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage codes" ON public.recharge_codes FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE public.roulette_spins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  position int NOT NULL,
  label text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roulette_spins TO authenticated;
GRANT ALL ON public.roulette_spins TO service_role;
ALTER TABLE public.roulette_spins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spins" ON public.roulette_spins FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.redeem_code(_code text) RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.recharge_codes; nb numeric;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO c FROM recharge_codes WHERE code = upper(trim(_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF c.redeemed_by IS NOT NULL THEN RAISE EXCEPTION 'Código já usado'; END IF;
  UPDATE recharge_codes SET redeemed_by = auth.uid(), redeemed_at = now() WHERE id = c.id;
  INSERT INTO wallets(user_id, balance) VALUES (auth.uid(), c.amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + c.amount, updated_at = now()
    RETURNING balance INTO nb;
  RETURN nb;
END $$;

CREATE OR REPLACE FUNCTION public.buy_tickets(_qty int) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE price numeric; w public.wallets;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  price := CASE _qty WHEN 1 THEN 1.76 WHEN 2 THEN 2.36 ELSE NULL END;
  IF price IS NULL THEN RAISE EXCEPTION 'Pacote inválido'; END IF;
  SELECT * INTO w FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.balance < price THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
  UPDATE wallets SET balance = balance - price, tickets = tickets + _qty, updated_at = now() WHERE user_id = auth.uid();
END $$;

CREATE OR REPLACE FUNCTION public.spin_roulette() RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.wallets; p int; s public.roulette_slots;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  SELECT * INTO w FROM wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.tickets < 1 THEN RAISE EXCEPTION 'Sem bilhetes'; END IF;
  p := floor(random()*10)::int;
  SELECT * INTO s FROM roulette_slots WHERE position = p;
  UPDATE wallets SET tickets = tickets - 1, updated_at = now() WHERE user_id = auth.uid();
  INSERT INTO roulette_spins(user_id, position, label, image_url) VALUES (auth.uid(), p, coalesce(s.label,''), s.image_url);
  RETURN p;
END $$;

CREATE OR REPLACE FUNCTION public.global_spins() RETURNS TABLE(label text, image_url text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT label, image_url, created_at FROM roulette_spins ORDER BY created_at DESC LIMIT 30
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_code(text), public.buy_tickets(int), public.spin_roulette(), public.global_spins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_code(text), public.buy_tickets(int), public.spin_roulette(), public.global_spins() TO authenticated;