-- Trend market: administrator-controlled reference price and user trade requests.
CREATE TABLE IF NOT EXISTS public.trend_market_state (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  asset_name text NOT NULL DEFAULT 'MARCHA vb',
  price numeric(18,2) NOT NULL DEFAULT 80004.00 CHECK (price > 0),
  change_percent numeric(8,3) NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.trend_market_state (id, asset_name, price, change_percent)
VALUES (1, 'MARCHA vb', 80004.00, 0)
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.trend_market_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Trend market price is readable" ON public.trend_market_state;
CREATE POLICY "Trend market price is readable" ON public.trend_market_state
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.trend_market_state TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.trend_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side text NOT NULL CHECK (side IN ('buy','sell')),
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0 AND quantity <= 1000000),
  reference_price numeric(18,2) NOT NULL CHECK (reference_price > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','completed','cancelled','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.trend_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own Trend orders" ON public.trend_orders;
CREATE POLICY "Users can view own Trend orders" ON public.trend_orders
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Users can create own Trend orders" ON public.trend_orders;
CREATE POLICY "Users can create own Trend orders" ON public.trend_orders
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');
GRANT SELECT, INSERT ON public.trend_orders TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_trend_price(_price numeric, _change_percent numeric DEFAULT 0)
RETURNS public.trend_market_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.trend_market_state;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas o administrador pode alterar o preço do Trend';
  END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 1000000000000 THEN
    RAISE EXCEPTION 'Preço inválido';
  END IF;
  IF _change_percent IS NULL OR _change_percent < -100 OR _change_percent > 100 THEN
    RAISE EXCEPTION 'Variação deve estar entre -100% e 100%';
  END IF;
  INSERT INTO public.trend_market_state (id, asset_name, price, change_percent, updated_by, updated_at)
  VALUES (1, 'MARCHA vb', _price, _change_percent, auth.uid(), now())
  ON CONFLICT (id) DO UPDATE SET price = EXCLUDED.price, change_percent = EXCLUDED.change_percent,
    updated_by = EXCLUDED.updated_by, updated_at = now()
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_trend_price(numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_trend_price(numeric,numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.trend_create_order(_side text, _quantity numeric, _price numeric)
RETURNS public.trend_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.trend_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para enviar uma ordem'; END IF;
  IF _side NOT IN ('buy','sell') THEN RAISE EXCEPTION 'Tipo de ordem inválido'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 1000000000000 THEN RAISE EXCEPTION 'Preço de negócio inválido'; END IF;
  INSERT INTO public.trend_orders(user_id, side, quantity, reference_price)
  VALUES(auth.uid(), _side, _quantity, _price)
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.trend_create_order(text,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trend_create_order(text,numeric,numeric) TO authenticated;
