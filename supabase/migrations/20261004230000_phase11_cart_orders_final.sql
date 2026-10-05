-- SHAKH 2027 Phase 11
-- Real Cart + Atomic Checkout + Orders
-- This final migration represents the live Phase 11 state applied to the new project.

create sequence if not exists private.order_number_seq start 100001;

create table if not exists public.checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  address_id uuid not null references public.addresses(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash_on_delivery','wallet','mobile_cash')),
  status text not null default 'created' check (status in ('created','submitted','cancelled','completed')),
  currency text not null default 'IQD',
  subtotal_iqd numeric(14,2) not null default 0 check (subtotal_iqd >= 0),
  delivery_fee_iqd numeric(14,2) not null default 0 check (delivery_fee_iqd >= 0),
  discount_iqd numeric(14,2) not null default 0 check (discount_iqd >= 0),
  total_iqd numeric(14,2) not null default 0 check (total_iqd >= 0),
  recipient_name text not null,
  phone text not null,
  city text not null,
  district text not null,
  street text,
  landmark text,
  notes text,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_user_id, idempotency_key)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default (
    'SK-' || to_char(now(), 'YYYYMMDD') || '-' ||
    lpad(nextval('private.order_number_seq')::text, 6, '0')
  ),
  checkout_session_id uuid not null references public.checkout_sessions(id) on delete restrict,
  buyer_user_id uuid not null references public.profiles(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  payment_method text not null check (payment_method in ('cash_on_delivery','wallet','mobile_cash')),
  payment_status text not null default 'pending' check (payment_status in ('pending','authorized','paid','failed','refunded')),
  status text not null default 'placed' check (status in ('pending_payment','placed','confirmed','processing','ready_for_pickup','out_for_delivery','delivered','cancelled','refunded')),
  currency text not null default 'IQD',
  subtotal_iqd numeric(14,2) not null default 0 check (subtotal_iqd >= 0),
  delivery_fee_iqd numeric(14,2) not null default 0 check (delivery_fee_iqd >= 0),
  discount_iqd numeric(14,2) not null default 0 check (discount_iqd >= 0),
  total_iqd numeric(14,2) not null default 0 check (total_iqd >= 0),
  shipping_recipient_name text not null,
  shipping_phone text not null,
  shipping_city text not null,
  shipping_district text not null,
  shipping_street text,
  shipping_landmark text,
  shipping_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  sku text,
  product_name_ckb text not null,
  product_name_ar text not null,
  product_name_en text not null,
  variant_label_ckb text not null,
  variant_label_ar text not null,
  variant_label_en text not null,
  image_storage_path text,
  unit_price_iqd numeric(14,2) not null check (unit_price_iqd >= 0),
  quantity integer not null check (quantity > 0),
  line_total_iqd numeric(14,2) not null check (line_total_iqd >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  status text not null check (status in ('pending_payment','placed','confirmed','processing','ready_for_pickup','out_for_delivery','delivered','cancelled','refunded')),
  actor_user_id uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkout_sessions_buyer_user_id on public.checkout_sessions(buyer_user_id);
create index if not exists idx_checkout_sessions_address_id on public.checkout_sessions(address_id);
create index if not exists idx_orders_checkout_session_id on public.orders(checkout_session_id);
create index if not exists idx_orders_buyer_user_id on public.orders(buyer_user_id);
create index if not exists idx_orders_vendor_id on public.orders(vendor_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_created_at on public.orders(created_at desc);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_order_items_product_id on public.order_items(product_id);
create index if not exists idx_order_items_variant_id on public.order_items(variant_id);
create index if not exists idx_order_items_vendor_id on public.order_items(vendor_id);
create index if not exists idx_order_status_history_order_id on public.order_status_history(order_id);
create index if not exists idx_order_status_history_actor_user_id on public.order_status_history(actor_user_id);
create index if not exists idx_cart_items_variant_id on public.cart_items(variant_id);

create or replace function private.set_updated_at_checkout()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at_checkout() from public;
revoke all on function private.set_updated_at_checkout() from anon;
revoke all on function private.set_updated_at_checkout() from authenticated;

drop trigger if exists checkout_sessions_set_updated_at on public.checkout_sessions;
create trigger checkout_sessions_set_updated_at
before update on public.checkout_sessions
for each row execute function private.set_updated_at_checkout();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at_checkout();

create or replace function private.record_order_status_history()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history(order_id, status, actor_user_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.record_order_status_history() from public;
revoke all on function private.record_order_status_history() from anon;
revoke all on function private.record_order_status_history() from authenticated;

drop trigger if exists orders_record_status on public.orders;
create trigger orders_record_status
after insert or update of status on public.orders
for each row execute function private.record_order_status_history();

create or replace function private.create_orders_from_cart(
  p_address_id uuid,
  p_payment_method text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_session public.checkout_sessions%rowtype;
  v_order_id uuid;
  v_vendor_id uuid;
  v_cart_count integer;
  v_valid_count integer;
  v_vendor_subtotal numeric(14,2);
  v_line_total numeric(14,2);
  v_inventory_available integer;
  v_unit_price numeric(14,2);
  v_total_subtotal numeric(14,2) := 0;
  v_line record;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_payment_method <> 'cash_on_delivery' then raise exception 'payment_method_not_enabled_in_phase_11' using errcode = 'P0001'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 128 then
    raise exception 'invalid_idempotency_key' using errcode = 'P0001';
  end if;

  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then raise exception 'address_not_found' using errcode = 'P0001'; end if;

  select * into v_session from public.checkout_sessions
  where buyer_user_id = v_user_id and idempotency_key = trim(p_idempotency_key);
  if found then
    return jsonb_build_object(
      'checkout_session_id', v_session.id,
      'status', v_session.status,
      'order_ids', coalesce((select jsonb_agg(o.id order by o.created_at) from public.orders o where o.checkout_session_id = v_session.id), '[]'::jsonb),
      'order_numbers', coalesce((select jsonb_agg(o.order_number order by o.created_at) from public.orders o where o.checkout_session_id = v_session.id), '[]'::jsonb),
      'total_iqd', v_session.total_iqd
    );
  end if;

  select count(*) into v_cart_count from public.cart_items where user_id = v_user_id;
  if v_cart_count = 0 then raise exception 'cart_empty' using errcode = 'P0001'; end if;

  perform 1 from public.cart_items where user_id = v_user_id for update;

  select count(*) into v_valid_count
  from public.cart_items ci
  join public.product_variants pv on pv.id = ci.variant_id and pv.is_active = true
  join public.products p on p.id = pv.product_id and p.status = 'active'
  join public.vendors v on v.id = p.vendor_id and v.status = 'active'
  join public.inventory i on i.variant_id = pv.id
  where ci.user_id = v_user_id
    and (i.quantity - i.reserved_quantity) >= ci.quantity;

  if v_valid_count <> v_cart_count then raise exception 'cart_contains_unavailable_item' using errcode = 'P0001'; end if;

  insert into public.checkout_sessions (
    buyer_user_id, address_id, payment_method, status,
    recipient_name, phone, city, district, street, landmark, notes,
    idempotency_key
  )
  values (
    v_user_id, v_address.id, p_payment_method, 'created',
    v_address.recipient_name, v_address.phone, v_address.city, v_address.district,
    v_address.street, v_address.landmark, v_address.notes, trim(p_idempotency_key)
  )
  returning * into v_session;

  for v_vendor_id in
    select distinct p.vendor_id
    from public.cart_items ci
    join public.product_variants pv on pv.id = ci.variant_id
    join public.products p on p.id = pv.product_id
    where ci.user_id = v_user_id
    order by p.vendor_id
  loop
    insert into public.orders (
      checkout_session_id, buyer_user_id, vendor_id, payment_method, status,
      shipping_recipient_name, shipping_phone, shipping_city,
      shipping_district, shipping_street, shipping_landmark, shipping_notes
    )
    values (
      v_session.id, v_user_id, v_vendor_id, p_payment_method, 'placed',
      v_address.recipient_name, v_address.phone, v_address.city,
      v_address.district, v_address.street, v_address.landmark, v_address.notes
    )
    returning id into v_order_id;

    v_vendor_subtotal := 0;

    for v_line in
      select
        ci.quantity as cart_quantity,
        pv.id as variant_id,
        pv.product_id as product_id,
        pv.sku as sku,
        pv.label_ckb as variant_label_ckb,
        pv.label_ar as variant_label_ar,
        pv.label_en as variant_label_en,
        pv.price_iqd as variant_price_iqd,
        p.name_ckb as product_name_ckb,
        p.name_ar as product_name_ar,
        p.name_en as product_name_en,
        p.vendor_id as vendor_id,
        i.quantity as inventory_quantity,
        i.reserved_quantity as inventory_reserved
      from public.cart_items ci
      join public.product_variants pv on pv.id = ci.variant_id and pv.is_active = true
      join public.products p on p.id = pv.product_id and p.status = 'active'
      join public.vendors v on v.id = p.vendor_id and v.status = 'active'
      join public.inventory i on i.variant_id = pv.id
      where ci.user_id = v_user_id and p.vendor_id = v_vendor_id
      order by ci.id
      for update of ci, pv, i
    loop
      v_inventory_available := v_line.inventory_quantity - v_line.inventory_reserved;
      if v_inventory_available < v_line.cart_quantity then raise exception 'inventory_race_condition' using errcode = 'P0001'; end if;
      v_unit_price := v_line.variant_price_iqd;
      v_line_total := v_unit_price * v_line.cart_quantity;

      update public.inventory
      set reserved_quantity = reserved_quantity + v_line.cart_quantity, updated_at = now()
      where variant_id = v_line.variant_id;

      insert into public.order_items (
        order_id, product_id, variant_id, vendor_id, sku,
        product_name_ckb, product_name_ar, product_name_en,
        variant_label_ckb, variant_label_ar, variant_label_en,
        unit_price_iqd, quantity, line_total_iqd
      )
      values (
        v_order_id, v_line.product_id, v_line.variant_id, v_line.vendor_id, v_line.sku,
        v_line.product_name_ckb, v_line.product_name_ar, v_line.product_name_en,
        v_line.variant_label_ckb, v_line.variant_label_ar, v_line.variant_label_en,
        v_unit_price, v_line.cart_quantity, v_line_total
      );
      v_vendor_subtotal := v_vendor_subtotal + v_line_total;
    end loop;

    update public.orders
    set subtotal_iqd = v_vendor_subtotal, total_iqd = v_vendor_subtotal
    where id = v_order_id;
    v_total_subtotal := v_total_subtotal + v_vendor_subtotal;
  end loop;

  delete from public.cart_items where user_id = v_user_id;

  update public.checkout_sessions
  set status = 'submitted', subtotal_iqd = v_total_subtotal, total_iqd = v_total_subtotal
  where id = v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'checkout_session_id', v_session.id,
    'status', v_session.status,
    'order_ids', coalesce((select jsonb_agg(o.id order by o.created_at) from public.orders o where o.checkout_session_id = v_session.id), '[]'::jsonb),
    'order_numbers', coalesce((select jsonb_agg(o.order_number order by o.created_at) from public.orders o where o.checkout_session_id = v_session.id), '[]'::jsonb),
    'total_iqd', v_session.total_iqd
  );
end;
$$;

revoke all on function private.create_orders_from_cart(uuid, text, text) from public;
revoke all on function private.create_orders_from_cart(uuid, text, text) from anon;
grant execute on function private.create_orders_from_cart(uuid, text, text) to authenticated;

create or replace function public.create_orders_from_cart(
  p_address_id uuid, p_payment_method text, p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  return private.create_orders_from_cart(p_address_id, p_payment_method, p_idempotency_key);
end;
$$;
revoke all on function public.create_orders_from_cart(uuid, text, text) from public;
revoke all on function public.create_orders_from_cart(uuid, text, text) from anon;
grant execute on function public.create_orders_from_cart(uuid, text, text) to authenticated;

create or replace function private.set_cart_item_quantity(p_variant_id uuid, p_quantity integer)
returns public.cart_items
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_stock integer;
  v_item public.cart_items%rowtype;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_quantity < 1 then raise exception 'invalid_cart_quantity' using errcode = 'P0001'; end if;
  select (i.quantity - i.reserved_quantity) into v_stock
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  join public.vendors v on v.id = p.vendor_id
  join public.inventory i on i.variant_id = pv.id
  where pv.id = p_variant_id and pv.is_active = true and p.status = 'active' and v.status = 'active'
  for update of i;
  if v_stock is null then raise exception 'variant_unavailable' using errcode = 'P0001'; end if;
  if p_quantity > v_stock then raise exception 'quantity_exceeds_available_stock' using errcode = 'P0001'; end if;
  insert into public.cart_items(user_id, variant_id, quantity)
  values (v_user_id, p_variant_id, p_quantity)
  on conflict (user_id, variant_id) do update set quantity = excluded.quantity, updated_at = now()
  returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.set_cart_item_quantity(p_variant_id uuid, p_quantity integer)
returns public.cart_items
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  return private.set_cart_item_quantity(p_variant_id, p_quantity);
end;
$$;
revoke all on function public.set_cart_item_quantity(uuid, integer) from public;
revoke all on function public.set_cart_item_quantity(uuid, integer) from anon;
grant execute on function public.set_cart_item_quantity(uuid, integer) to authenticated;
revoke all on function private.set_cart_item_quantity(uuid, integer) from public;
revoke all on function private.set_cart_item_quantity(uuid, integer) from anon;
grant execute on function private.set_cart_item_quantity(uuid, integer) to authenticated;

create or replace function private.add_variant_to_cart(p_variant_id uuid, p_quantity integer default 1)
returns public.cart_items
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_user_id uuid := auth.uid();
  v_stock integer;
  v_existing integer := 0;
  v_item public.cart_items%rowtype;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  if p_quantity < 1 then raise exception 'invalid_cart_quantity' using errcode = 'P0001'; end if;
  select (i.quantity - i.reserved_quantity) into v_stock
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  join public.vendors v on v.id = p.vendor_id
  join public.inventory i on i.variant_id = pv.id
  where pv.id = p_variant_id and pv.is_active = true and p.status = 'active' and v.status = 'active'
  for update of i;
  if v_stock is null then raise exception 'variant_unavailable' using errcode = 'P0001'; end if;
  select quantity into v_existing from public.cart_items where user_id = v_user_id and variant_id = p_variant_id for update;
  if coalesce(v_existing, 0) + p_quantity > v_stock then raise exception 'quantity_exceeds_available_stock' using errcode = 'P0001'; end if;
  insert into public.cart_items(user_id, variant_id, quantity)
  values (v_user_id, p_variant_id, coalesce(v_existing, 0) + p_quantity)
  on conflict (user_id, variant_id) do update set quantity = excluded.quantity, updated_at = now()
  returning * into v_item;
  return v_item;
end;
$$;

create or replace function public.add_variant_to_cart(p_variant_id uuid, p_quantity integer default 1)
returns public.cart_items
language plpgsql
security invoker
set search_path = pg_catalog, public, private
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  return private.add_variant_to_cart(p_variant_id, p_quantity);
end;
$$;
revoke all on function public.add_variant_to_cart(uuid, integer) from public;
revoke all on function public.add_variant_to_cart(uuid, integer) from anon;
grant execute on function public.add_variant_to_cart(uuid, integer) to authenticated;
revoke all on function private.add_variant_to_cart(uuid, integer) from public;
revoke all on function private.add_variant_to_cart(uuid, integer) from anon;
grant execute on function private.add_variant_to_cart(uuid, integer) to authenticated;

alter table public.checkout_sessions enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;

create policy "users read own checkout sessions" on public.checkout_sessions
for select to authenticated using ((select auth.uid()) = buyer_user_id);

create policy "customers read own or permitted orders" on public.orders
for select to authenticated using (
  (select auth.uid()) = buyer_user_id
  or exists (select 1 from public.vendors v where v.id = vendor_id and v.owner_user_id = (select auth.uid()))
  or (select private.has_permission('orders.read'))
);

create policy "customers read order items" on public.order_items
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_user_id = (select auth.uid())
        or (select private.has_permission('orders.read'))
        or exists (select 1 from public.vendors v where v.id = o.vendor_id and v.owner_user_id = (select auth.uid()))
      )
  )
);

create policy "customers read order status history" on public.order_status_history
for select to authenticated using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.buyer_user_id = (select auth.uid())
        or (select private.has_permission('orders.read'))
        or exists (select 1 from public.vendors v where v.id = o.vendor_id and v.owner_user_id = (select auth.uid()))
      )
  )
);
