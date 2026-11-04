CREATE OR REPLACE FUNCTION public.buy_product_vb(_product_id uuid, _code text DEFAULT NULL::text, _option integer DEFAULT NULL::integer, _answer text DEFAULT NULL::text)
 RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE p public.products; w public.wallets; c public.product_contents; d public.discount_codes; charge numeric(14,2); pct int := 0; base numeric; pname text; ans text; q boolean; has_c boolean := false; buyer_email text; adm_email text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
  IF _product_id IS NULL THEN RAISE EXCEPTION 'Produto inválido'; END IF;
  SELECT * INTO p FROM public.products WHERE id = _product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto indisponível'; END IF;
  q := p.require_question AND coalesce(trim(p.buyer_question), '') <> '';
  ans := nullif(trim(coalesce(_answer, '')), '');
  IF q THEN
    IF ans IS NULL THEN RAISE EXCEPTION 'Responda à pergunta antes de pagar'; END IF;
    IF length(ans) > 1000 THEN RAISE EXCEPTION 'Resposta demasiado longa'; END IF;
  ELSE ans := NULL; END IF;
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
  ELSE
    SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND option_index IS NULL AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
  END IF;
  has_c := FOUND;
  IF NOT has_c AND NOT q THEN
    IF p.options_enabled THEN RAISE EXCEPTION 'Esta opção está esgotada'; END IF;
    RAISE EXCEPTION 'Conteúdos esgotados. O administrador deve adicionar mais conteúdos.';
  END IF;
  charge := round((base / 85 * (100 - pct) / 100)::numeric, 2);
  IF p.vip_discount AND public.is_vip(auth.uid()) THEN charge := round(charge * 0.7, 2); END IF;
  SELECT * INTO w FROM public.wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF charge > 0 AND (NOT FOUND OR w.balance < charge) THEN RAISE EXCEPTION 'Saldo vb$ insuficiente'; END IF;
  IF charge > 0 THEN UPDATE public.wallets SET balance = balance - charge, updated_at = now() WHERE user_id = auth.uid(); END IF;
  IF pct > 0 THEN UPDATE public.discount_codes SET used_by = auth.uid(), used_at = now() WHERE id = d.id; END IF;
  IF NOT p.options_enabled THEN UPDATE public.products SET stock = stock - 1 WHERE id = _product_id; END IF;
  IF has_c THEN UPDATE public.product_contents SET delivered_to = auth.uid(), delivered_at = now() WHERE delivery_order = c.delivery_order; END IF;
  pname := CASE WHEN p.options_enabled THEN p.name || ' · Opção ' || (_option + 1) ELSE p.name END;
  INSERT INTO public.product_mail(user_id, product_id, content_order, product_name, paid_vb, content_text, content_link, media_url, option_index, buyer_question, buyer_answer)
  VALUES(auth.uid(), p.id, CASE WHEN has_c THEN c.delivery_order ELSE 0 END, pname, charge,
    CASE WHEN has_c THEN c.content_text ELSE 'Pedido recebido. O ADM vai tratar da sua compra em Pedidos.' END,
    CASE WHEN has_c THEN c.content_link END, CASE WHEN has_c THEN c.media_url END, _option,
    CASE WHEN q THEN p.buyer_question END, ans);
  IF q THEN
    SELECT email INTO buyer_email FROM auth.users WHERE id = auth.uid();
    SELECT u.email INTO adm_email FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE r.role = 'admin' ORDER BY u.created_at LIMIT 1;
    INSERT INTO public.chat_messages(user_id, sender_id, from_admin, body)
    VALUES(auth.uid(), auth.uid(), false,
      'Nova compra · ' || pname || ' (' || charge || ' vb$)' ||
      E'\nPara ADM: ' || coalesce(adm_email, '-') ||
      E'\nCliente: ' || coalesce(buyer_email, '-') ||
      E'\nPergunta: ' || p.buyer_question || E'\nResposta: ' || ans);
  END IF;
  RETURN charge;
END $function$;