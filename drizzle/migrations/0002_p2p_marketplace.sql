-- ===== VIP =====
create table public.vip_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  activated_at timestamptz not null default now()
);
grant select on public.vip_memberships to authenticated;
grant all on public.vip_memberships to service_role;
alter table public.vip_memberships enable row level security;
create policy "Users view own vip membership" on public.vip_memberships for select to authenticated using (auth.uid() = user_id);
create policy "Admins view all vip memberships" on public.vip_memberships for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace function public.is_vip(_user_id uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $function$
  select exists (select 1 from public.vip_memberships where user_id = _user_id)
$function$;

create or replace function public.activate_vip()
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare w public.wallets;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into w from public.wallets where user_id = auth.uid() for update;
  if exists (select 1 from public.vip_memberships where user_id = auth.uid()) then
    raise exception 'O seu VIP já está ativo';
  end if;
  if not found or w.balance < 10 then raise exception 'Precisa de pelo menos 10 vb$ de saldo'; end if;
  update public.wallets set balance = balance - 10, updated_at = now() where user_id = auth.uid();
  insert into public.vip_memberships(user_id) values (auth.uid()) on conflict (user_id) do nothing;
end $function$;

-- ===== Ofertas P2P =====
create table public.p2p_offers (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null,
  seller_name text not null default '',
  amount_vb numeric(14,2) not null,
  sold_vb numeric(14,2) not null default 0,
  reserved_vb numeric(14,2) not null default 0,
  price_per_vb numeric(14,2) not null,
  mpesa_number text,
  emola_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index p2p_offers_status_idx on public.p2p_offers (status, created_at desc);
grant select on public.p2p_offers to anon, authenticated;
grant all on public.p2p_offers to service_role;
alter table public.p2p_offers enable row level security;
create policy "Anyone can view offers" on public.p2p_offers for select using (true);
create trigger p2p_offers_updated before update on public.p2p_offers
  for each row execute function public.update_updated_at_column();

-- ===== Pedidos P2P =====
create table public.p2p_orders (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.p2p_offers(id),
  buyer_id uuid not null,
  buyer_name text not null default '',
  seller_id uuid not null,
  amount_vb numeric(14,2) not null,
  price_per_vb numeric(14,2) not null,
  total_mt numeric(14,2) not null,
  status text not null default 'pending',
  receipt_note text,
  receipt_image_url text,
  dispute_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index p2p_orders_buyer_idx on public.p2p_orders (buyer_id, created_at desc);
create index p2p_orders_seller_idx on public.p2p_orders (seller_id, created_at desc);
grant select on public.p2p_orders to authenticated;
grant all on public.p2p_orders to service_role;
alter table public.p2p_orders enable row level security;
create policy "Participants and admins view orders" on public.p2p_orders for select to authenticated
  using (auth.uid() = buyer_id or auth.uid() = seller_id or public.has_role(auth.uid(), 'admin'));
create trigger p2p_orders_updated before update on public.p2p_orders
  for each row execute function public.update_updated_at_column();

-- Comprovativos: qualquer utilizador autenticado pode enviar imagem para products/p2p/
create policy "Users upload p2p receipts"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'products' and (storage.foldername(name))[1] = 'p2p');

-- ===== RPCs do marketplace =====
create or replace function public.p2p_create_offer(
  _amount_vb numeric, _price_per_vb numeric, _mpesa_number text, _emola_number text)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_seller uuid := auth.uid(); v_offer uuid; v_name text; w public.wallets;
begin
  if v_seller is null then raise exception 'Faça login'; end if;
  if not public.is_vip(v_seller) then raise exception 'A criação de ofertas é exclusiva para membros VIP.'; end if;
  if _amount_vb is null or _amount_vb <= 0 or _amount_vb <> round(_amount_vb, 2) then raise exception 'Quantidade de vb$ inválida.'; end if;
  if _price_per_vb is null or _price_per_vb <= 0 or _price_per_vb <> round(_price_per_vb, 2) then raise exception 'Preço por vb$ inválido.'; end if;
  if coalesce(trim(_mpesa_number), '') = '' and coalesce(trim(_emola_number), '') = '' then
    raise exception 'Indique pelo menos um número para receber os pagamentos.';
  end if;
  select coalesce(nullif(display_name, ''), 'Vendedor') into v_name from public.profiles where user_id = v_seller;
  select * into w from public.wallets where user_id = v_seller for update;
  if not found or w.balance < _amount_vb then raise exception 'Saldo vb$ insuficiente para reservar essa quantidade.'; end if;
  update public.wallets set balance = balance - _amount_vb, updated_at = now() where user_id = v_seller;
  insert into public.p2p_offers(seller_id, seller_name, amount_vb, price_per_vb, mpesa_number, emola_number)
  values (v_seller, v_name, _amount_vb, _price_per_vb, nullif(trim(_mpesa_number), ''), nullif(trim(_emola_number), ''))
  returning id into v_offer;
  return v_offer;
end $function$;

create or replace function public.p2p_cancel_offer(_offer_id uuid)
returns numeric
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_offers; v_open int; v_refund numeric(14,2);
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_offers where id = _offer_id and seller_id = auth.uid() for update;
  if not found then raise exception 'Oferta não encontrada.'; end if;
  if o.status <> 'active' then raise exception 'Oferta já encerrada.'; end if;
  select count(*) into v_open from public.p2p_orders
  where offer_id = _offer_id and status in ('pending','receipt_sent','rejected','disputed');
  if v_open > 0 then raise exception 'Existem negociações abertas nesta oferta. Resolva-as primeiro.'; end if;
  v_refund := o.amount_vb - o.sold_vb;
  if v_refund > 0 then
    update public.wallets set balance = balance + v_refund, updated_at = now() where user_id = auth.uid();
  end if;
  update public.p2p_offers set status = 'cancelled' where id = _offer_id;
  return v_refund;
end $function$;

create or replace function public.p2p_create_order(_offer_id uuid, _amount_vb numeric)
returns uuid
language plpgsql security definer
set search_path to 'public'
as $function$
declare v_buyer uuid := auth.uid(); o public.p2p_offers; v_available numeric(14,2); v_name text; v_order uuid;
begin
  if v_buyer is null then raise exception 'Faça login'; end if;
  if _amount_vb is null or _amount_vb <= 0 or _amount_vb <> round(_amount_vb, 2) then raise exception 'Quantidade inválida.'; end if;
  select * into o from public.p2p_offers where id = _offer_id for update;
  if not found or o.status <> 'active' then raise exception 'Oferta indisponível.'; end if;
  if o.seller_id = v_buyer then raise exception 'Não pode comprar a sua própria oferta.'; end if;
  v_available := o.amount_vb - o.sold_vb - o.reserved_vb;
  if _amount_vb > v_available then raise exception 'Quantidade indisponível nesta oferta.'; end if;
  select coalesce(nullif(display_name, ''), 'Comprador') into v_name from public.profiles where user_id = v_buyer;
  insert into public.p2p_orders(offer_id, buyer_id, buyer_name, seller_id, amount_vb, price_per_vb, total_mt)
  values (_offer_id, v_buyer, v_name, o.seller_id, _amount_vb, o.price_per_vb, round(_amount_vb * o.price_per_vb, 2))
  returning id into v_order;
  update public.p2p_offers set reserved_vb = reserved_vb + _amount_vb where id = _offer_id;
  return v_order;
end $function$;

create or replace function public.p2p_submit_receipt(_order_id uuid, _note text, _image_url text)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_orders where id = _order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status not in ('pending','rejected') then raise exception 'Este pedido já não aceita comprovativo.'; end if;
  if coalesce(trim(_note), '') = '' and coalesce(trim(_image_url), '') = '' then
    raise exception 'Escreva uma nota ou envie a imagem do comprovativo.';
  end if;
  update public.p2p_orders set status = 'receipt_sent', receipt_note = nullif(trim(_note), ''), receipt_image_url = nullif(trim(_image_url), '')
  where id = _order_id;
end $function$;

create or replace function public.p2p_cancel_order(_order_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_orders where id = _order_id and buyer_id = auth.uid() for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status <> 'pending' then raise exception 'Só é possível cancelar antes de enviar o comprovativo.'; end if;
  update public.p2p_orders set status = 'cancelled' where id = _order_id;
  update public.p2p_offers set reserved_vb = greatest(reserved_vb - o.amount_vb, 0) where id = o.offer_id;
end $function$;

create or replace function public.p2p_confirm_order(_order_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders; off public.p2p_offers;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.seller_id <> auth.uid() and not public.has_role(auth.uid(), 'admin') then raise exception 'Apenas o vendedor pode confirmar.'; end if;
  if o.status <> 'receipt_sent' then raise exception 'Este pedido não tem comprovativo para confirmar.'; end if;
  select * into off from public.p2p_offers where id = o.offer_id for update;
  update public.wallets set balance = balance + o.amount_vb, updated_at = now() where user_id = o.buyer_id;
  if not found then insert into public.wallets(user_id, balance) values (o.buyer_id, o.amount_vb); end if;
  update public.p2p_orders set status = 'confirmed' where id = o.id;
  update public.p2p_offers
  set reserved_vb = greatest(reserved_vb - o.amount_vb, 0),
      sold_vb = sold_vb + o.amount_vb,
      status = case when sold_vb + o.amount_vb >= amount_vb then 'closed' else status end
  where id = o.offer_id;
end $function$;

create or replace function public.p2p_reject_order(_order_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.seller_id <> auth.uid() then raise exception 'Apenas o vendedor pode recusar.'; end if;
  if o.status <> 'receipt_sent' then raise exception 'Este pedido não tem comprovativo para recusar.'; end if;
  update public.p2p_orders set status = 'rejected' where id = o.id;
end $function$;

create or replace function public.p2p_report_dispute(_order_id uuid, _reason text)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null then raise exception 'Faça login'; end if;
  if coalesce(trim(_reason), '') = '' then raise exception 'Descreva o problema para o administrador.'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.buyer_id <> auth.uid() and o.seller_id <> auth.uid() then raise exception 'Apenas os participantes podem comunicar um problema.'; end if;
  if o.status not in ('pending','receipt_sent','rejected') then raise exception 'Esta negociação já não pode entrar em disputa.'; end if;
  update public.p2p_orders set status = 'disputed', dispute_reason = trim(_reason) where id = o.id;
end $function$;

create or replace function public.p2p_resolve_dispute(_order_id uuid, _release boolean)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
declare o public.p2p_orders;
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'Acesso reservado ao administrador.'; end if;
  select * into o from public.p2p_orders where id = _order_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if o.status <> 'disputed' then raise exception 'Este pedido não está em disputa.'; end if;
  if _release then
    update public.wallets set balance = balance + o.amount_vb, updated_at = now() where user_id = o.buyer_id;
    if not found then insert into public.wallets(user_id, balance) values (o.buyer_id, o.amount_vb); end if;
    update public.p2p_orders set status = 'confirmed' where id = o.id;
    update public.p2p_offers
    set reserved_vb = greatest(reserved_vb - o.amount_vb, 0),
        sold_vb = sold_vb + o.amount_vb,
        status = case when sold_vb + o.amount_vb >= amount_vb then 'closed' else status end
    where id = o.offer_id;
  else
    update public.p2p_orders set status = 'cancelled' where id = o.id;
    update public.p2p_offers set reserved_vb = greatest(reserved_vb - o.amount_vb, 0) where id = o.offer_id;
  end if;
end $function$;