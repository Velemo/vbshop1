
-- Nome do responsável por cada número de pagamento
ALTER TABLE public.p2p_offers ADD COLUMN mpesa_name text, ADD COLUMN emola_name text;

-- Regras P2P configuráveis pelo ADM (linha única id=1)
CREATE TABLE public.p2p_settings (
  id integer primary key default 1 check (id = 1),
  min_buy_vb numeric not null default 0,
  min_price_per_vb numeric not null default 0,
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.p2p_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.p2p_settings TO authenticated;
GRANT ALL ON public.p2p_settings TO service_role;
ALTER TABLE public.p2p_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p2p_settings_read" ON public.p2p_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "p2p_settings_admin_write" ON public.p2p_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Vendedores com visita ao site nos últimos 15 minutos (para priorizar ofertas)
CREATE OR REPLACE FUNCTION public.p2p_online_sellers()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT user_id FROM public.site_visits
  WHERE user_id IS NOT NULL AND created_at > now() - interval '15 minutes';
$$;
GRANT EXECUTE ON FUNCTION public.p2p_online_sellers() TO anon, authenticated;

-- Criar oferta: exige nome responsável por cada número e respeita o preço mínimo do ADM
DROP FUNCTION public.p2p_create_offer(numeric, numeric, text, text);
CREATE OR REPLACE FUNCTION public.p2p_create_offer(
  _amount_vb numeric, _price_per_vb numeric, _mpesa_number text, _emola_number text,
  _mpesa_name text DEFAULT '', _emola_name text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare
  v_seller uuid := auth.uid();
  v_offer uuid;
  v_name text;
  w public.wallets;
  v_min_price numeric;
begin
  if v_seller is null then raise exception 'Faça login'; end if;
  if not public.is_vip(v_seller) then raise exception 'A criação de ofertas é exclusiva para membros VIP.'; end if;
  if _amount_vb is null or _amount_vb <= 0 or _amount_vb <> round(_amount_vb, 2) then raise exception 'Quantidade de vb$ inválida.'; end if;
  if _price_per_vb is null or _price_per_vb <= 0 or _price_per_vb <> round(_price_per_vb, 2) then raise exception 'Preço por vb$ inválido.'; end if;
  if coalesce(trim(_mpesa_number), '') = '' and coalesce(trim(_emola_number), '') = '' then
    raise exception 'Indique pelo menos um número para receber os pagamentos.';
  end if;
  if coalesce(trim(_mpesa_number), '') <> '' and coalesce(trim(_mpesa_name), '') = '' then
    raise exception 'Indique o nome responsável pelo número M-Pesa.';
  end if;
  if coalesce(trim(_emola_number), '') <> '' and coalesce(trim(_emola_name), '') = '' then
    raise exception 'Indique o nome responsável pelo número e-Mola.';
  end if;
  select min_price_per_vb into v_min_price from public.p2p_settings where id = 1;
  if coalesce(v_min_price, 0) > 0 and _price_per_vb < v_min_price then
    raise exception 'O preço mínimo por vb$ definido pelo ADM é % MT.', trim(to_char(v_min_price, 'FM999999990.00'));
  end if;
  select coalesce(nullif(display_name, ''), 'Vendedor') into v_name from public.profiles where user_id = v_seller;
  select * into w from public.wallets where user_id = v_seller for update;
  if not found or w.balance < _amount_vb then raise exception 'Saldo vb$ insuficiente para reservar essa quantidade.'; end if;
  update public.wallets set balance = balance - _amount_vb, updated_at = now() where user_id = v_seller;
  insert into public.p2p_offers(seller_id, seller_name, amount_vb, price_per_vb, mpesa_number, emola_number, mpesa_name, emola_name)
  values (v_seller, v_name, _amount_vb, _price_per_vb,
          nullif(trim(_mpesa_number), ''), nullif(trim(_emola_number), ''),
          nullif(trim(_mpesa_name), ''), nullif(trim(_emola_name), ''))
  returning id into v_offer;
  return v_offer;
end $function$;

-- Criar pedido: respeita o valor mínimo de compra definido pelo ADM
CREATE OR REPLACE FUNCTION public.p2p_create_order(_offer_id uuid, _amount_vb numeric)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_buyer uuid := auth.uid();
  o public.p2p_offers;
  v_available numeric(14,2);
  v_name text;
  v_order uuid;
  v_min_buy numeric;
BEGIN
  IF v_buyer IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('p2p-buyer:' || v_buyer::text, 0));
  IF EXISTS (SELECT 1 FROM public.p2p_orders WHERE buyer_id = v_buyer AND status IN ('pending','receipt_sent','rejected','disputed')) THEN
    RAISE EXCEPTION 'Já tem um pedido ativo. Conclua ou cancele o pedido em Pedidos antes de comprar novamente.';
  END IF;
  IF _amount_vb IS NULL OR _amount_vb <= 0 OR _amount_vb <> round(_amount_vb, 2) THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
  SELECT min_buy_vb INTO v_min_buy FROM public.p2p_settings WHERE id = 1;
  IF coalesce(v_min_buy, 0) > 0 AND _amount_vb < v_min_buy THEN
    RAISE EXCEPTION 'A compra mínima é de % vb$.', trim(to_char(v_min_buy, 'FM999999990.00'));
  END IF;
  SELECT * INTO o FROM public.p2p_offers WHERE id = _offer_id FOR UPDATE;
  IF NOT FOUND OR o.status <> 'active' THEN RAISE EXCEPTION 'Oferta indisponível.'; END IF;
  IF o.seller_id = v_buyer THEN RAISE EXCEPTION 'Não pode comprar a sua própria oferta.'; END IF;
  v_available := o.amount_vb - o.sold_vb - o.reserved_vb;
  IF _amount_vb > v_available THEN RAISE EXCEPTION 'Quantidade indisponível nesta oferta.'; END IF;
  SELECT coalesce(nullif(display_name, ''), 'Comprador') INTO v_name FROM public.profiles WHERE user_id = v_buyer;
  INSERT INTO public.p2p_orders(offer_id, buyer_id, buyer_name, seller_id, amount_vb, price_per_vb, total_mt)
  VALUES (_offer_id, v_buyer, coalesce(v_name, 'Comprador'), o.seller_id, _amount_vb, o.price_per_vb, round(_amount_vb * o.price_per_vb, 2))
  RETURNING id INTO v_order;
  UPDATE public.p2p_offers SET reserved_vb = reserved_vb + _amount_vb WHERE id = _offer_id;
  RETURN v_order;
END $function$;
