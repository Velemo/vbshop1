CREATE TABLE public.product_contents (
  delivery_order bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  content_text text NOT NULL DEFAULT '',
  content_link text,
  media_url text,
  delivered_to uuid,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_content_valid CHECK (length(content_text) <= 4000 AND (content_link IS NULL OR (length(content_link) <= 2048 AND content_link ~* '^https?://')) AND (media_url IS NULL OR (length(media_url) <= 2048 AND media_url ~* '^https?://'))),
  CONSTRAINT delivery_pair CHECK ((delivered_to IS NULL) = (delivered_at IS NULL))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_contents TO authenticated;
GRANT ALL ON public.product_contents TO service_role;
GRANT USAGE ON SEQUENCE public.product_contents_delivery_order_seq TO authenticated;
ALTER TABLE public.product_contents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manages product contents" ON public.product_contents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX product_contents_available_idx ON public.product_contents(product_id, delivery_order) WHERE delivered_at IS NULL;
CREATE TRIGGER product_contents_updated BEFORE UPDATE ON public.product_contents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.product_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  content_order bigint NOT NULL UNIQUE REFERENCES public.product_contents(delivery_order),
  product_name text NOT NULL,
  paid_vb numeric(14,2) NOT NULL,
  content_text text NOT NULL DEFAULT '',
  content_link text,
  media_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_mail TO authenticated;
GRANT ALL ON public.product_mail TO service_role;
ALTER TABLE public.product_mail ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer reads own product mail" ON public.product_mail FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER product_mail_updated BEFORE UPDATE ON public.product_mail FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.buy_product_vb(_product_id uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.products; w public.wallets; c public.product_contents; charge numeric(14,2);
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  IF _product_id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  IF p.stock < 1 THEN RAISE EXCEPTION 'Produto esgotado'; END IF;
  SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conteúdos esgotados. O administrador deve adicionar mais conteúdos.'; END IF;
  charge := round((CASE WHEN p.promo_price IS NOT NULL AND p.promo_ends_at > now() THEN p.promo_price ELSE p.price END / 85)::numeric, 2);
  IF charge <= 0 THEN RAISE EXCEPTION 'Preço inválido'; END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR w.balance < charge THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
  UPDATE public.wallets SET balance = balance - charge, updated_at = now() WHERE user_id = auth.uid();
  UPDATE public.products SET stock = stock - 1 WHERE id = _product_id;
  UPDATE public.product_contents SET delivered_to = auth.uid(), delivered_at = now() WHERE delivery_order = c.delivery_order;
  INSERT INTO public.product_mail(user_id, product_id, content_order, product_name, paid_vb, content_text, content_link, media_url)
  VALUES(auth.uid(), p.id, c.delivery_order, p.name, charge, c.content_text, c.content_link, c.media_url);
  RETURN charge;
END $$;
REVOKE ALL ON FUNCTION public.buy_product_vb(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_product_vb(uuid) TO authenticated;