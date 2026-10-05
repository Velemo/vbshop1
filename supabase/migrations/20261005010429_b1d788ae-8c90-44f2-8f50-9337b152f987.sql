ALTER TABLE public.products ADD COLUMN allow_discount boolean NOT NULL DEFAULT false;
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  percent integer NOT NULL CHECK (percent BETWEEN 1 AND 100),
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT ALL ON public.discount_codes TO service_role;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage discount codes" ON public.discount_codes FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.check_discount(_product_id uuid, _code text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE d public.discount_codes; ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  SELECT allow_discount INTO ok FROM products WHERE id = _product_id;
  IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'Este produto não aceita código de desconto'; END IF;
  SELECT * INTO d FROM discount_codes WHERE code = upper(trim(_code));
  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
  IF d.used_by IS NOT NULL THEN RAISE EXCEPTION 'Código já usado'; END IF;
  RETURN d.percent;
END $$;

DROP FUNCTION public.buy_product_vb(uuid);
CREATE FUNCTION public.buy_product_vb(_product_id uuid, _code text DEFAULT NULL)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.products; w public.wallets; c public.product_contents; d public.discount_codes; charge numeric(14,2); pct int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  IF _product_id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  IF p.stock < 1 THEN RAISE EXCEPTION 'Produto esgotado'; END IF;
  IF _code IS NOT NULL AND trim(_code) <> '' THEN
    IF NOT p.allow_discount THEN RAISE EXCEPTION 'Este produto não aceita código de desconto'; END IF;
    SELECT * INTO d FROM public.discount_codes WHERE code = upper(trim(_code)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido'; END IF;
    IF d.used_by IS NOT NULL THEN RAISE EXCEPTION 'Código já usado'; END IF;
    pct := d.percent;
  END IF;
  SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conteúdos esgotados. O administrador deve adicionar mais conteúdos.'; END IF;
  charge := round((CASE WHEN p.promo_price IS NOT NULL AND p.promo_ends_at > now() THEN p.promo_price ELSE p.price END / 85 * (100 - pct) / 100)::numeric, 2);
  IF charge < 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF charge > 0 AND (NOT FOUND OR w.balance < charge) THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
  IF charge > 0 THEN UPDATE public.wallets SET balance = balance - charge, updated_at = now() WHERE user_id = auth.uid(); END IF;
  IF pct > 0 THEN UPDATE public.discount_codes SET used_by = auth.uid(), used_at = now() WHERE id = d.id; END IF;
  UPDATE public.products SET stock = stock - 1 WHERE id = _product_id;
  UPDATE public.product_contents SET delivered_to = auth.uid(), delivered_at = now() WHERE delivery_order = c.delivery_order;
  INSERT INTO public.product_mail(user_id, product_id, content_order, product_name, paid_vb, content_text, content_link, media_url)
  VALUES(auth.uid(), p.id, c.delivery_order, p.name, charge, c.content_text, c.content_link, c.media_url);
  RETURN charge;
END $function$;
REVOKE EXECUTE ON FUNCTION public.buy_product_vb(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.buy_product_vb(uuid,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_discount(uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.check_discount(uuid,text) TO authenticated;