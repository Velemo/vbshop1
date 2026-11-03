ALTER TABLE public.vip_memberships ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE public.vip_memberships SET expires_at = activated_at + interval '30 days' WHERE expires_at IS NULL;
ALTER TABLE public.vip_memberships ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS vip_discount boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_vip(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from public.vip_memberships where user_id = _user_id and expires_at > now())
$function$;

CREATE OR REPLACE FUNCTION public.activate_vip()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare w public.wallets; cur timestamptz;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if not found or w.balance < 10 then raise exception 'Precisa de pelo menos 10 vb$ de saldo para ativar o VIP'; end if;
  select expires_at into cur from public.vip_memberships where user_id = auth.uid();
  if found and cur > now() then raise exception 'O seu VIP já está ativo'; end if;
  insert into public.vip_memberships(user_id, activated_at, expires_at)
  values (auth.uid(), now(), now() + interval '30 days')
  on conflict (user_id) do update set activated_at = now(), expires_at = now() + interval '30 days';
end $function$;

CREATE OR REPLACE FUNCTION public.buy_product_vb(_product_id uuid, _code text DEFAULT NULL::text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    IF d.expires_at IS NOT NULL AND d.expires_at < now() THEN RAISE EXCEPTION 'Código expirado'; END IF;
    pct := d.percent;
  END IF;
  SELECT * INTO c FROM public.product_contents WHERE product_id = _product_id AND delivered_at IS NULL ORDER BY delivery_order LIMIT 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conteúdos esgotados. O administrador deve adicionar mais conteúdos.'; END IF;
  charge := round((CASE WHEN p.promo_price IS NOT NULL AND p.promo_ends_at > now() THEN p.promo_price ELSE p.price END / 85 * (100 - pct) / 100)::numeric, 2);
  IF p.vip_discount AND public.is_vip(auth.uid()) THEN charge := round(charge * 0.7, 2); END IF;
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

DROP FUNCTION public.global_spins();
CREATE FUNCTION public.global_spins()
 RETURNS TABLE(label text, image_url text, created_at timestamp with time zone, winner_name text, avatar_url text, vip boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT sp.label, sp.image_url, sp.created_at,
         coalesce(nullif(p.display_name, ''), 'Utilizador') AS winner_name,
         nullif(p.avatar_url, '') AS avatar_url,
         public.is_vip(sp.user_id) AS vip
  FROM public.roulette_spins sp
  LEFT JOIN public.profiles p ON p.user_id = sp.user_id
  ORDER BY sp.created_at DESC LIMIT 30
$function$;

DROP FUNCTION public.admin_list_users();
CREATE FUNCTION public.admin_list_users()
 RETURNS TABLE(user_id uuid, email text, account_created_at timestamp with time zone, user_code text, display_name text, avatar_url text, balance numeric, tickets integer, is_banned boolean, is_vip boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Acesso reservado ao administrador' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT u.id,u.email::text,u.created_at,p.user_code,COALESCE(NULLIF(p.display_name,''),u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),COALESCE(NULLIF(p.avatar_url,''),u.raw_user_meta_data->>'avatar_url',u.raw_user_meta_data->>'picture'),COALESCE(w.balance,0)::numeric,COALESCE(w.tickets,0)::integer,COALESCE(u.banned_until>now(),false),public.is_vip(u.id)
 FROM auth.users u LEFT JOIN public.profiles p ON p.user_id=u.id LEFT JOIN public.wallets w ON w.user_id=u.id ORDER BY u.created_at DESC;
END; $function$;