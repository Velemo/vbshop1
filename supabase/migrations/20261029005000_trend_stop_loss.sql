-- Add optional Stop Loss to user-created Trend orders.
ALTER TABLE public.trend_orders
  ADD COLUMN IF NOT EXISTS stop_loss numeric(18,2) NULL
  CHECK (stop_loss IS NULL OR stop_loss > 0);

DROP FUNCTION IF EXISTS public.trend_create_order(text,numeric,numeric);

CREATE OR REPLACE FUNCTION public.trend_create_order(
  _side text,
  _quantity numeric,
  _price numeric,
  _stop_loss numeric DEFAULT NULL
)
RETURNS public.trend_orders
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result public.trend_orders;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Faça login para enviar uma ordem'; END IF;
  IF _side NOT IN ('buy','sell') THEN RAISE EXCEPTION 'Tipo de ordem inválido'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 OR _quantity > 1000000 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF _price IS NULL OR _price <= 0 OR _price > 1000000000000 THEN RAISE EXCEPTION 'Preço de negócio inválido'; END IF;
  IF _stop_loss IS NOT NULL AND _stop_loss <= 0 THEN RAISE EXCEPTION 'Stop Loss inválido'; END IF;
  IF _stop_loss IS NOT NULL AND _side = 'buy' AND _stop_loss >= _price THEN
    RAISE EXCEPTION 'Num Longo, o Stop Loss deve ficar abaixo do preço de entrada';
  END IF;
  IF _stop_loss IS NOT NULL AND _side = 'sell' AND _stop_loss <= _price THEN
    RAISE EXCEPTION 'Num Curto, o Stop Loss deve ficar acima do preço de entrada';
  END IF;
  INSERT INTO public.trend_orders(user_id, side, quantity, reference_price, stop_loss)
  VALUES(auth.uid(), _side, _quantity, _price, _stop_loss)
  RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.trend_create_order(text,numeric,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trend_create_order(text,numeric,numeric,numeric) TO authenticated;
