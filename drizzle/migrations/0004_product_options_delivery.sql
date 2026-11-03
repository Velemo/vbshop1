ALTER TABLE public.products ADD COLUMN IF NOT EXISTS options_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS option_prices jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.product_contents ADD COLUMN IF NOT EXISTS option_index integer;
ALTER TABLE public.product_mail ADD COLUMN IF NOT EXISTS option_index integer;

CREATE OR REPLACE FUNCTION public.product_option_stock(_product_id uuid)
RETURNS TABLE(option_index integer, available bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT pc.option_index, count(*) FROM public.product_contents pc
  WHERE pc.product_id = _product_id AND pc.delivered_at IS NULL AND pc.option_index IS NOT NULL
  GROUP BY pc.option_index
$$;
GRANT EXECUTE ON FUNCTION public.product_option_stock(uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.buy_product_vb(uuid, text);
CREATE FUNCTION public.buy_product_vb(_product_id uuid, _code text DEFAULT NULL::text, _option integer DEFAULT NULL::integer)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.products; w public.wallets; c public.product_contents; d public.discount_codes; charge numeric(14,2); pct int := 0; base numeric; pname text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  IF _product_id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  IF p.options_enabled THEN
    IF _option IS NULL OR _option < 0 OR _option >= jsonb_array_length(p.option_prices) THEN RAISE EXCEPTION 'Escolha uma opção'; END IF;
    base := nullif(p.option_prices->>_option, '')::numeric;
    IF base IS NULL OR base < 0 THEN RAISE EXCEPTION 'Opção sem preço'; END IF;
  ELSE
    IF p.stock < 1 THEN RAISE EXCEPTION 'Produto esgotado'; END IF;
    base := CASE WHEN p.promo_price IS NOT NULL AND p.promo_ends_at > now() THEN p.promo_price ELSE p.price END;
  END IF;
  IF _code IS NOT NULL AND trim(_code) <> '' THEN
    IF NOT p.allow_discount THEN RAISE EXCEPTION 'Este produto não aceita código de desconto'; END IF;
    SELECT * INTO d FROM public.discount_codes WHERE code = upper(trim(_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
    IF d.used_by IS NOT NULL THEN RAISE EXCEPTION 'Código já usado'; END IF;
    IF d.expires_at IS NOT NULL AND d.expires_at < now() THEN RAISE EXCEPTION 'Código expirado'; END IF;
    pct := d.percent;
  END IF;
  IF p.options_enabled THEN
    SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND option_index = _option AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RAISE EXCEPTION 'Esta opção está esgotada'; END IF;
  ELSE
    SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND option_index IS NULL AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conteúdos esgotados. O administrador deve adicionar mais conteúdos.'; END IF;
  END IF;
  charge := round((base / 85 * (100 - pct) / 100)::numeric, 2);
  IF p.vip_discount AND public.is_vip(auth.uid()) THEN charge := round(charge * 0.7, 2); END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF charge > 0 AND (NOT FOUND OR w.balance < charge) THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
  IF charge > 0 THEN UPDATE public.wallets SET balance = balance - charge, updated_at = now() WHERE user_id = auth.uid(); END IF;
  IF pct > 0 THEN UPDATE public.discount_codes SET used_by = auth.uid(), used_at = now() WHERE id = d.id; END IF;
  IF NOT p.options_enabled THEN UPDATE public.products SET stock = stock - 1 WHERE id = _product_id; END IF;
  UPDATE public.product_contents SET delivered_to = auth.uid(), delivered_at = now() WHERE delivery_order = c.delivery_order;
  pname := CASE WHEN p.options_enabled THEN p.name || ' · Opção ' || (_option + 1) ELSE p.name END;
  INSERT INTO public.product_mail(user_id, product_id, content_order, product_name, paid_vb, content_text, content_link, media_url, option_index)
  VALUES(auth.uid(), p.id, c.delivery_order, pname, charge, c.content_text, c.content_link, c.media_url, _option);
  RETURN charge;
END $function$;
REVOKE EXECUTE ON FUNCTION public.buy_product_vb(uuid, text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.buy_product_vb(uuid, text, integer) TO authenticated;