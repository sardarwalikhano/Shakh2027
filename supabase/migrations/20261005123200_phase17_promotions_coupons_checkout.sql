-- ---------------------------------------------------------------------------
-- Promotions / coupons
-- ---------------------------------------------------------------------------

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name_ckb text not null,
  name_ar text not null,
  name_en text not null,
  description_ckb text,
  description_ar text,
  description_en text,
  promotion_type text not null default 'coupon' check (promotion_type in ('automatic','coupon')),
  discount_type text not null check (discount_type in ('percentage','fixed')),
  discount_value numeric(14,2) not null check (discount_value >= 0 and (discount_type <> 'percentage' or discount_value <= 100)),
  max_discount_iqd numeric(14,2) check (max_discount_iqd is null or max_discount_iqd >= 0),
  min_subtotal_iqd numeric(14,2) not null default 0 check (min_subtotal_iqd >= 0),
  vendor_id uuid references public.vendors(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  priority integer not null default 0 check (priority >= 0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  usage_limit bigint check (usage_limit is null or usage_limit > 0),
  usage_count bigint not null default 0 check (usage_count >= 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_valid_window check (ends_at is null or ends_at > starts_at),
  constraint promotions_usage_not_over_limit check (usage_limit is null or usage_count <= usage_limit)
);

create table if not exists public.coupon_codes (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  code text not null unique,
  usage_limit bigint check (usage_limit is null or usage_limit > 0),
  usage_count bigint not null default 0 check (usage_count >= 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint coupon_usage_not_over_limit check (usage_limit is null or usage_count <= usage_limit)
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupon_codes(id) on delete set null,
  promotion_id uuid not null references public.promotions(id) on delete restrict,
  buyer_user_id uuid not null references auth.users(id) on delete restrict,
  checkout_session_id uuid not null references public.checkout_sessions(id) on delete restrict,
  discount_iqd numeric(14,2) not null check (discount_iqd >= 0),
  created_at timestamptz not null default now(),
  unique (promotion_id, checkout_session_id)
);

alter table public.checkout_sessions
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null,
  add column if not exists coupon_id uuid references public.coupon_codes(id) on delete set null,
  add column if not exists coupon_code text;

alter table public.orders
  add column if not exists promotion_id uuid references public.promotions(id) on delete set null,
  add column if not exists coupon_id uuid references public.coupon_codes(id) on delete set null,
  add column if not exists coupon_code text;

create index if not exists idx_promotions_active_window on public.promotions(is_active, starts_at, ends_at);
create index if not exists idx_promotions_vendor_id on public.promotions(vendor_id);
create index if not exists idx_promotions_category_id on public.promotions(category_id);
create index if not exists idx_coupon_codes_promotion_id on public.coupon_codes(promotion_id);
create index if not exists idx_coupon_redemptions_buyer_user_id on public.coupon_redemptions(buyer_user_id);
create index if not exists idx_coupon_redemptions_checkout_session_id on public.coupon_redemptions(checkout_session_id);
create index if not exists idx_checkout_sessions_promotion_id on public.checkout_sessions(promotion_id);
create index if not exists idx_orders_promotion_id on public.orders(promotion_id);

-- RLS: business-critical promotion/coupon rows are not directly writable/readable
-- through the Data API. Safe RPCs below are the public contract.
alter table public.promotions enable row level security;
alter table public.coupon_codes enable row level security;
alter table public.coupon_redemptions enable row level security;

revoke all on table public.promotions from anon, authenticated;
revoke all on table public.coupon_codes from anon, authenticated;
revoke all on table public.coupon_redemptions from anon, authenticated;

-- Permissions
insert into public.permissions(code,name_ckb,name_ar,name_en,description)
values
  ('promotions.read','خوێندنەوەی پرۆمۆشن','قراءة العروض','Read promotions','View promotion/coupon operational data'),
  ('promotions.manage','بەڕێوەبردنی پرۆمۆشن','إدارة العروض','Manage promotions','Create, update and deactivate promotions/coupons'),
  ('analytics.read','خوێندنەوەی ئەنالیتیکس','قراءة التحليلات','Read analytics','View aggregated platform analytics'),
  ('analytics.manage','بەڕێوەبردنی ئەنالیتیکس','إدارة التحليلات','Manage analytics','Manage analytics configuration')
on conflict (code) do nothing;

insert into public.role_permissions(role_code,permission_code)
select r.code, p.code
from public.app_roles r
cross join public.permissions p
where r.code in ('super_admin','admin')
  and p.code in ('promotions.read','promotions.manage','analytics.read','analytics.manage')
on conflict (role_code, permission_code) do nothing;

-- Updated-at trigger helper (private, non-exposed)
create or replace function private.set_updated_at_phase17()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function private.set_updated_at_phase17() from public, anon, authenticated;

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at
before update on public.promotions
for each row execute function private.set_updated_at_phase17();

-- ---------------------------------------------------------------------------
-- Promotion engine helpers
-- ---------------------------------------------------------------------------

create or replace function private.promotion_line_matches(
  p_vendor_id uuid,
  p_category_id uuid,
  p_promotion public.promotions
)
returns boolean
language sql
immutable
set search_path = pg_catalog, public, private
as $$
  select (p_promotion.vendor_id is null or p_promotion.vendor_id = p_vendor_id)
     and (p_promotion.category_id is null or p_promotion.category_id = p_category_id);
$$;
revoke all on function private.promotion_line_matches(uuid,uuid,public.promotions) from public,anon,authenticated;

create or replace function private.calculate_cart_promotion(
  p_user_id uuid,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_coupon public.coupon_codes%rowtype;
  v_promotion public.promotions%rowtype;
  v_code text := nullif(upper(trim(p_coupon_code)), '');
  v_cart_subtotal numeric(14,2) := 0;
  v_eligible_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2) := 0;
  v_now timestamptz := now();
  v_used_count bigint := 0;
  v_valid boolean := false;
  v_reason text := null;
begin
  if p_user_id is null then
    return jsonb_build_object('valid',false,'reason','not_authenticated','discount_iqd',0);
  end if;

  select coalesce(sum(pv.price_iqd * ci.quantity),0)
    into v_cart_subtotal
  from public.cart_items ci
  join public.product_variants pv on pv.id=ci.variant_id and pv.is_active=true
  join public.products pr on pr.id=pv.product_id and pr.status='active'
  join public.vendors ve on ve.id=pr.vendor_id and ve.status='active'
  join public.inventory inv on inv.variant_id=pv.id
  where ci.user_id=p_user_id
    and inv.quantity-inv.reserved_quantity >= ci.quantity;

  if v_code is not null then
    select * into v_coupon
    from public.coupon_codes cc
    where cc.code=v_code and cc.is_active=true;

    if not found then
      return jsonb_build_object('valid',false,'reason','coupon_not_found','code',v_code,'discount_iqd',0,'subtotal_iqd',v_cart_subtotal);
    end if;

    select * into v_promotion from public.promotions p where p.id=v_coupon.promotion_id;
    if not found then
      return jsonb_build_object('valid',false,'reason','promotion_not_found','code',v_code,'discount_iqd',0,'subtotal_iqd',v_cart_subtotal);
    end if;

    if v_promotion.promotion_type <> 'coupon' then
      return jsonb_build_object('valid',false,'reason','promotion_requires_automatic_flow','code',v_code,'discount_iqd',0,'subtotal_iqd',v_cart_subtotal);
    end if;
  else
    select * into v_promotion
    from public.promotions p
    where p.is_active=true
      and p.promotion_type='automatic'
      and p.starts_at <= v_now
      and (p.ends_at is null or p.ends_at > v_now)
      and (p.usage_limit is null or p.usage_count < p.usage_limit)
    order by p.priority desc, p.created_at desc
    limit 1;
    if not found then
      return jsonb_build_object('valid',false,'reason','no_automatic_promotion','discount_iqd',0,'subtotal_iqd',v_cart_subtotal);
    end if;
  end if;

  if not v_promotion.is_active or v_promotion.starts_at > v_now or (v_promotion.ends_at is not null and v_promotion.ends_at <= v_now) then
    v_reason := 'promotion_inactive_or_expired';
  elsif v_promotion.usage_limit is not null and v_promotion.usage_count >= v_promotion.usage_limit then
    v_reason := 'promotion_usage_limit_reached';
  elsif v_cart_subtotal <= 0 then
    v_reason := 'cart_empty_or_unavailable';
  end if;

  if v_reason is null and v_code is not null then
    if v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit then
      v_reason := 'coupon_usage_limit_reached';
    else
      select count(*) into v_used_count
      from public.coupon_redemptions cr
      where cr.coupon_id=v_coupon.id and cr.buyer_user_id=p_user_id;
      if v_used_count >= least(v_coupon.per_user_limit, v_promotion.per_user_limit) then
        v_reason := 'coupon_per_user_limit_reached';
      end if;
    end if;
  elsif v_reason is null and v_promotion.per_user_limit > 0 then
    select count(*) into v_used_count
    from public.coupon_redemptions cr
    where cr.promotion_id=v_promotion.id and cr.buyer_user_id=p_user_id;
    if v_used_count >= v_promotion.per_user_limit then
      v_reason := 'promotion_per_user_limit_reached';
    end if;
  end if;

  if v_reason is null then
    select coalesce(sum(pv.price_iqd * ci.quantity),0)
      into v_eligible_subtotal
    from public.cart_items ci
    join public.product_variants pv on pv.id=ci.variant_id and pv.is_active=true
    join public.products pr on pr.id=pv.product_id and pr.status='active'
    join public.vendors ve on ve.id=pr.vendor_id and ve.status='active'
    join public.inventory inv on inv.variant_id=pv.id
    where ci.user_id=p_user_id
      and inv.quantity-inv.reserved_quantity >= ci.quantity
      and private.promotion_line_matches(pr.vendor_id,pr.category_id,v_promotion);

    if v_eligible_subtotal < v_promotion.min_subtotal_iqd then
      v_reason := 'minimum_subtotal_not_met';
    else
      if v_promotion.discount_type='percentage' then
        v_discount := round(v_eligible_subtotal * v_promotion.discount_value / 100.0, 2);
      else
        v_discount := least(v_eligible_subtotal, v_promotion.discount_value);
      end if;
      if v_promotion.max_discount_iqd is not null then
        v_discount := least(v_discount, v_promotion.max_discount_iqd);
      end if;
      v_discount := greatest(0, least(v_discount, v_eligible_subtotal));
      v_valid := v_discount > 0;
      if not v_valid then v_reason := 'discount_is_zero'; end if;
    end if;
  end if;

  return jsonb_build_object(
    'valid',v_valid,
    'reason',v_reason,
    'code',v_code,
    'coupon_id',case when v_code is not null and v_coupon.id is not null then v_coupon.id else null end,
    'promotion_id',case when v_promotion.id is not null then v_promotion.id else null end,
    'discount_iqd',v_discount,
    'subtotal_iqd',v_cart_subtotal,
    'eligible_subtotal_iqd',v_eligible_subtotal,
    'promotion_type',case when v_promotion.id is not null then v_promotion.promotion_type else null end,
    'discount_type',case when v_promotion.id is not null then v_promotion.discount_type else null end,
    'discount_value',case when v_promotion.id is not null then v_promotion.discount_value else null end
  );
end;
$$;
revoke all on function private.calculate_cart_promotion(uuid,text) from public,anon,authenticated;
grant execute on function private.calculate_cart_promotion(uuid,text) to authenticated;

-- Public coupon validation uses the caller identity and never accepts a trusted subtotal.
create or replace function public.validate_coupon(p_code text)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  return private.calculate_cart_promotion(auth.uid(),p_code);
end;
$$;
revoke all on function public.validate_coupon(text) from public, anon;
grant execute on function public.validate_coupon(text) to authenticated;

create or replace function private.list_active_promotions()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare v_rows jsonb;
begin
  select coalesce(jsonb_agg(x order by x.priority desc,x.created_at desc),'[]'::jsonb)
    into v_rows
  from (
    select p.id,p.name_ckb,p.name_ar,p.name_en,p.description_ckb,p.description_ar,p.description_en,
           p.promotion_type,p.discount_type,p.discount_value,p.max_discount_iqd,p.min_subtotal_iqd,
           p.vendor_id,p.category_id,p.priority,p.starts_at,p.ends_at,p.created_at
    from public.promotions p
    where p.is_active=true
      and p.starts_at<=now()
      and (p.ends_at is null or p.ends_at>now())
      and (p.usage_limit is null or p.usage_count<p.usage_limit)
    limit 100
  ) x;
  return jsonb_build_object('items',v_rows,'generated_at',now());
end;
$$;
revoke all on function private.list_active_promotions() from public, authenticated, anon;
grant execute on function private.list_active_promotions() to anon, authenticated;

create or replace function public.list_active_promotions()
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.list_active_promotions(); end; $$;
revoke all on function public.list_active_promotions() from public;
grant execute on function public.list_active_promotions() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Secure promotion management RPCs
-- ---------------------------------------------------------------------------

create or replace function private.require_promotions_manage()
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if auth.uid() is null or not private.has_permission('promotions.manage') then
    raise exception 'promotions_manage_permission_required' using errcode='P0001';
  end if;
end;
$$;
revoke all on function private.require_promotions_manage() from public,anon,authenticated;


create or replace function private.create_promotion(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_row public.promotions%rowtype;
begin
  perform private.require_promotions_manage();
  if p_payload is null then raise exception 'promotion_payload_required' using errcode='P0001'; end if;
  insert into public.promotions(
    name_ckb,name_ar,name_en,description_ckb,description_ar,description_en,
    promotion_type,discount_type,discount_value,max_discount_iqd,min_subtotal_iqd,
    vendor_id,category_id,priority,starts_at,ends_at,usage_limit,per_user_limit,created_by
  ) values (
    nullif(trim(p_payload->>'name_ckb'),''),
    nullif(trim(p_payload->>'name_ar'),''),
    nullif(trim(p_payload->>'name_en'),''),
    nullif(p_payload->>'description_ckb',''),
    nullif(p_payload->>'description_ar',''),
    nullif(p_payload->>'description_en',''),
    coalesce(nullif(p_payload->>'promotion_type',''),'coupon'),
    nullif(p_payload->>'discount_type',''),
    coalesce((p_payload->>'discount_value')::numeric,0),
    nullif(p_payload->>'max_discount_iqd','')::numeric,
    coalesce((p_payload->>'min_subtotal_iqd')::numeric,0),
    nullif(p_payload->>'vendor_id','')::uuid,
    nullif(p_payload->>'category_id','')::uuid,
    coalesce((p_payload->>'priority')::integer,0),
    coalesce((p_payload->>'starts_at')::timestamptz,now()),
    nullif(p_payload->>'ends_at','')::timestamptz,
    nullif(p_payload->>'usage_limit','')::bigint,
    greatest(1,coalesce((p_payload->>'per_user_limit')::integer,1)),
    auth.uid()
  ) returning * into v_row;
  return jsonb_build_object('item',to_jsonb(v_row));
exception when not_null_violation then
  raise exception 'promotion_required_field_missing' using errcode='P0001';
end;
$$;
revoke all on function private.create_promotion(jsonb) from public,anon,authenticated;
grant execute on function private.create_promotion(jsonb) to authenticated;

create or replace function public.create_promotion(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.create_promotion(p_payload); end; $$;
revoke all on function public.create_promotion(jsonb) from public,anon;
grant execute on function public.create_promotion(jsonb) to authenticated;

create or replace function private.create_coupon_code(
  p_promotion_id uuid, p_code text, p_usage_limit bigint default null, p_per_user_limit integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_row public.coupon_codes%rowtype;
begin
  perform private.require_promotions_manage();
  if p_promotion_id is null then raise exception 'promotion_id_required' using errcode='P0001'; end if;
  if p_code is null or length(trim(p_code)) < 3 or length(trim(p_code)) > 64 then raise exception 'invalid_coupon_code' using errcode='P0001'; end if;
  if not exists (select 1 from public.promotions p where p.id=p_promotion_id and p.promotion_type='coupon') then
    raise exception 'coupon_requires_coupon_promotion' using errcode='P0001';
  end if;
  insert into public.coupon_codes(promotion_id,code,usage_limit,per_user_limit,created_by)
  values(p_promotion_id,upper(trim(p_code)),p_usage_limit,greatest(1,coalesce(p_per_user_limit,1)),auth.uid())
  returning * into v_row;
  return jsonb_build_object('item',to_jsonb(v_row));
exception when unique_violation then
  raise exception 'coupon_code_already_exists' using errcode='P0001';
end;
$$;
revoke all on function private.create_coupon_code(uuid,text,bigint,integer) from public,anon,authenticated;
grant execute on function private.create_coupon_code(uuid,text,bigint,integer) to authenticated;

create or replace function public.create_coupon_code(
  p_promotion_id uuid, p_code text, p_usage_limit bigint default null, p_per_user_limit integer default 1
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.create_coupon_code(p_promotion_id,p_code,p_usage_limit,p_per_user_limit); end; $$;
revoke all on function public.create_coupon_code(uuid,text,bigint,integer) from public,anon;
grant execute on function public.create_coupon_code(uuid,text,bigint,integer) to authenticated;

create or replace function private.set_promotion_active(p_promotion_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_row public.promotions%rowtype;
begin
  perform private.require_promotions_manage();
  update public.promotions set is_active=coalesce(p_is_active,false),updated_at=now() where id=p_promotion_id returning * into v_row;
  if not found then raise exception 'promotion_not_found' using errcode='P0001'; end if;
  return jsonb_build_object('item',to_jsonb(v_row));
end;
$$;
revoke all on function private.set_promotion_active(uuid,boolean) from public,anon,authenticated;
grant execute on function private.set_promotion_active(uuid,boolean) to authenticated;

create or replace function public.set_promotion_active(p_promotion_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.set_promotion_active(p_promotion_id,p_is_active); end; $$;
revoke all on function public.set_promotion_active(uuid,boolean) from public,anon;
grant execute on function public.set_promotion_active(uuid,boolean) to authenticated;

create or replace function private.set_coupon_active(p_coupon_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_row public.coupon_codes%rowtype;
begin
  perform private.require_promotions_manage();
  update public.coupon_codes set is_active=coalesce(p_is_active,false) where id=p_coupon_id returning * into v_row;
  if not found then raise exception 'coupon_not_found' using errcode='P0001'; end if;
  return jsonb_build_object('item',to_jsonb(v_row));
end;
$$;
revoke all on function private.set_coupon_active(uuid,boolean) from public,anon,authenticated;
grant execute on function private.set_coupon_active(uuid,boolean) to authenticated;

create or replace function public.set_coupon_active(p_coupon_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.set_coupon_active(p_coupon_id,p_is_active); end; $$;
revoke all on function public.set_coupon_active(uuid,boolean) from public,anon;
grant execute on function public.set_coupon_active(uuid,boolean) to authenticated;

create or replace function private.list_promotions_admin(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_rows jsonb;
begin
  perform private.require_promotions_manage();
  p_limit:=greatest(1,least(coalesce(p_limit,100),250));
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_rows
  from (
    select p.id,p.name_ckb,p.name_ar,p.name_en,p.promotion_type,p.discount_type,p.discount_value,
           p.max_discount_iqd,p.min_subtotal_iqd,p.vendor_id,p.category_id,p.priority,p.starts_at,p.ends_at,
           p.usage_limit,p.usage_count,p.per_user_limit,p.is_active,p.created_at,p.updated_at,
           coalesce((select jsonb_agg(jsonb_build_object(
             'id',cc.id,'code',cc.code,'usage_limit',cc.usage_limit,'usage_count',cc.usage_count,
             'per_user_limit',cc.per_user_limit,'is_active',cc.is_active,'created_at',cc.created_at
           ) order by cc.created_at desc) from public.coupon_codes cc where cc.promotion_id=p.id),'[]'::jsonb) as coupons
    from public.promotions p
    order by p.created_at desc
    limit p_limit
  ) x;
  return jsonb_build_object('items',v_rows,'limit',p_limit,'generated_at',now());
end;
$$;
revoke all on function private.list_promotions_admin(integer) from public,anon,authenticated;
grant execute on function private.list_promotions_admin(integer) to authenticated;

create or replace function public.list_promotions_admin(p_limit integer default 100)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.list_promotions_admin(p_limit); end; $$;
revoke all on function public.list_promotions_admin(integer) from public,anon;
grant execute on function public.list_promotions_admin(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Search API: public active catalog only, no raw table access is widened.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Checkout: new optional coupon argument, while keeping existing 3-arg RPCs.
-- ---------------------------------------------------------------------------

create or replace function private.create_orders_from_cart(
  p_address_id uuid,
  p_payment_method text,
  p_idempotency_key text,
  p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_address public.addresses%rowtype;
  v_session public.checkout_sessions%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_vendor_id uuid;
  v_cart_count integer;
  v_valid_count integer;
  v_vendor_count integer;
  v_vendor_index integer := 0;
  v_vendor_subtotal numeric(14,2);
  v_vendor_eligible_subtotal numeric(14,2);
  v_line_total numeric(14,2);
  v_inventory_available integer;
  v_unit_price numeric(14,2);
  v_total_subtotal numeric(14,2) := 0;
  v_total_discount numeric(14,2) := 0;
  v_eligible_total numeric(14,2) := 0;
  v_discount_total numeric(14,2) := 0;
  v_discount_for_vendor numeric(14,2) := 0;
  v_allocated_discount numeric(14,2) := 0;
  v_line record;
  v_order_status text;
  v_promo_eval jsonb;
  v_promotion_id uuid;
  v_coupon_id uuid;
  v_normalized_coupon text := nullif(upper(trim(p_coupon_code)), '');
  v_promotion public.promotions%rowtype;
  v_coupon public.coupon_codes%rowtype;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_payment_method not in ('cash_on_delivery','wallet','mobile_cash') then raise exception 'unsupported_payment_method' using errcode='P0001'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 16 or length(p_idempotency_key) > 128 then raise exception 'invalid_idempotency_key' using errcode='P0001'; end if;
  if v_normalized_coupon is not null and length(v_normalized_coupon)>64 then raise exception 'invalid_coupon_code' using errcode='P0001'; end if;

  select * into v_address from public.addresses where id=p_address_id and user_id=v_user_id;
  if not found then raise exception 'address_not_found' using errcode='P0001'; end if;

  select * into v_session
  from public.checkout_sessions
  where buyer_user_id=v_user_id and idempotency_key=trim(p_idempotency_key)
  for update;
  if found then
    return jsonb_build_object(
      'checkout_session_id',v_session.id,'status',v_session.status,
      'order_ids',coalesce((select jsonb_agg(o.id order by o.created_at) from public.orders o where o.checkout_session_id=v_session.id),'[]'::jsonb),
      'order_numbers',coalesce((select jsonb_agg(o.order_number order by o.created_at) from public.orders o where o.checkout_session_id=v_session.id),'[]'::jsonb),
      'total_iqd',v_session.total_iqd,'discount_iqd',v_session.discount_iqd,
      'promotion_id',v_session.promotion_id,'coupon_id',v_session.coupon_id,'coupon_code',v_session.coupon_code
    );
  end if;

  select count(*) into v_cart_count from public.cart_items where user_id=v_user_id;
  if v_cart_count=0 then raise exception 'cart_empty' using errcode='P0001'; end if;
  perform 1 from public.cart_items where user_id=v_user_id for update;

  select count(*) into v_valid_count
  from public.cart_items ci
  join public.product_variants pv on pv.id=ci.variant_id and pv.is_active=true
  join public.products p on p.id=pv.product_id and p.status='active'
  join public.vendors v on v.id=p.vendor_id and v.status='active'
  join public.inventory i on i.variant_id=pv.id
  where ci.user_id=v_user_id and (i.quantity-i.reserved_quantity)>=ci.quantity;
  if v_valid_count<>v_cart_count then raise exception 'cart_contains_unavailable_item' using errcode='P0001'; end if;

  if v_normalized_coupon is not null then
    select * into v_coupon from public.coupon_codes where code=v_normalized_coupon and is_active=true for update;
    if not found then raise exception 'coupon_not_found' using errcode='P0001'; end if;
    select * into v_promotion from public.promotions where id=v_coupon.promotion_id for update;
    if not found then raise exception 'promotion_not_found' using errcode='P0001'; end if;
  end if;

  -- The locked rows make usage-limit checks and increments atomic per coupon/promotion.
  v_promo_eval:=private.calculate_cart_promotion(v_user_id,v_normalized_coupon);
  if coalesce((v_promo_eval->>'valid')::boolean,false) and v_normalized_coupon is null then
    v_promotion_id:=(v_promo_eval->>'promotion_id')::uuid;
    if v_promotion_id is not null then
      select * into v_promotion from public.promotions where id=v_promotion_id for update;
      v_promo_eval:=private.calculate_cart_promotion(v_user_id,null);
    end if;
  end if;
  if coalesce((v_promo_eval->>'valid')::boolean,false) then
    v_promotion_id:=(v_promo_eval->>'promotion_id')::uuid;
    v_coupon_id:=nullif(v_promo_eval->>'coupon_id','')::uuid;
    v_discount_total:=coalesce((v_promo_eval->>'discount_iqd')::numeric,0);
    v_eligible_total:=coalesce((v_promo_eval->>'eligible_subtotal_iqd')::numeric,0);
    if v_normalized_coupon is not null then
      update public.coupon_codes set usage_count=usage_count+1 where id=v_coupon_id;
    end if;
    update public.promotions set usage_count=usage_count+1 where id=v_promotion_id;
  elsif v_normalized_coupon is not null then
    raise exception 'coupon_invalid:%',coalesce(v_promo_eval->>'reason','invalid_coupon') using errcode='P0001';
  else
    v_discount_total:=0; v_eligible_total:=0;
  end if;

  insert into public.checkout_sessions(
    buyer_user_id,address_id,payment_method,status,recipient_name,phone,city,district,street,landmark,notes,idempotency_key,
    promotion_id,coupon_id,coupon_code,discount_iqd
  ) values(
    v_user_id,v_address.id,p_payment_method,'created',v_address.recipient_name,v_address.phone,v_address.city,v_address.district,
    v_address.street,v_address.landmark,v_address.notes,trim(p_idempotency_key),v_promotion_id,v_coupon_id,v_normalized_coupon,0
  ) returning * into v_session;

  if v_promotion_id is not null then
    insert into public.coupon_redemptions(coupon_id,promotion_id,buyer_user_id,checkout_session_id,discount_iqd)
    values(v_coupon_id,v_promotion_id,v_user_id,v_session.id,v_discount_total);
  end if;

  select count(distinct p.vendor_id) into v_vendor_count
  from public.cart_items ci
  join public.product_variants pv on pv.id=ci.variant_id
  join public.products p on p.id=pv.product_id
  where ci.user_id=v_user_id;

  v_order_status:=case when p_payment_method='mobile_cash' then 'pending_payment' else 'placed' end;

  for v_vendor_id in
    select distinct p.vendor_id
    from public.cart_items ci
    join public.product_variants pv on pv.id=ci.variant_id
    join public.products p on p.id=pv.product_id
    where ci.user_id=v_user_id
    order by p.vendor_id
  loop
    v_vendor_index:=v_vendor_index+1;
    v_vendor_eligible_subtotal:=0;
    if v_promotion_id is not null then
      select coalesce(sum(pv.price_iqd*ci.quantity),0) into v_vendor_eligible_subtotal
      from public.cart_items ci
      join public.product_variants pv on pv.id=ci.variant_id and pv.is_active=true
      join public.products p on p.id=pv.product_id and p.status='active'
      join public.vendors v on v.id=p.vendor_id and v.status='active'
      join public.inventory i on i.variant_id=pv.id
      where ci.user_id=v_user_id and p.vendor_id=v_vendor_id and (i.quantity-i.reserved_quantity)>=ci.quantity
        and private.promotion_line_matches(p.vendor_id,p.category_id,v_promotion);
    end if;

    insert into public.orders(
      checkout_session_id,buyer_user_id,vendor_id,payment_method,status,shipping_recipient_name,shipping_phone,shipping_city,
      shipping_district,shipping_street,shipping_landmark,shipping_notes,promotion_id,coupon_id,coupon_code
    ) values(
      v_session.id,v_user_id,v_vendor_id,p_payment_method,v_order_status,v_address.recipient_name,v_address.phone,v_address.city,
      v_address.district,v_address.street,v_address.landmark,v_address.notes,v_promotion_id,v_coupon_id,v_normalized_coupon
    ) returning id,order_number into v_order_id,v_order_number;

    v_vendor_subtotal:=0;
    for v_line in
      select ci.id as cart_item_id,ci.quantity as cart_quantity,pv.id as variant_id,pv.product_id,pv.sku,
             pv.label_ckb as variant_label_ckb,pv.label_ar as variant_label_ar,pv.label_en as variant_label_en,pv.price_iqd as variant_price_iqd,
             p.name_ckb as product_name_ckb,p.name_ar as product_name_ar,p.name_en as product_name_en,p.vendor_id,
             i.quantity as inventory_quantity,i.reserved_quantity as inventory_reserved
      from public.cart_items ci
      join public.product_variants pv on pv.id=ci.variant_id and pv.is_active=true
      join public.products p on p.id=pv.product_id and p.status='active'
      join public.vendors v on v.id=p.vendor_id and v.status='active'
      join public.inventory i on i.variant_id=pv.id
      where ci.user_id=v_user_id and p.vendor_id=v_vendor_id
      order by ci.id
      for update of ci,pv,i
    loop
      v_inventory_available:=v_line.inventory_quantity-v_line.inventory_reserved;
      if v_inventory_available<v_line.cart_quantity then raise exception 'inventory_race_condition' using errcode='P0001'; end if;
      v_unit_price:=v_line.variant_price_iqd;
      v_line_total:=v_unit_price*v_line.cart_quantity;
      update public.inventory set reserved_quantity=reserved_quantity+v_line.cart_quantity,updated_at=now() where variant_id=v_line.variant_id;
      insert into public.order_items(
        order_id,product_id,variant_id,vendor_id,sku,product_name_ckb,product_name_ar,product_name_en,
        variant_label_ckb,variant_label_ar,variant_label_en,unit_price_iqd,quantity,line_total_iqd
      ) values(
        v_order_id,v_line.product_id,v_line.variant_id,v_line.vendor_id,v_line.sku,v_line.product_name_ckb,v_line.product_name_ar,v_line.product_name_en,
        v_line.variant_label_ckb,v_line.variant_label_ar,v_line.variant_label_en,v_unit_price,v_line.cart_quantity,v_line_total
      );
      v_vendor_subtotal:=v_vendor_subtotal+v_line_total;
    end loop;

    if v_promotion_id is not null and v_eligible_total>0 and v_vendor_eligible_subtotal>0 then
      if v_vendor_index=v_vendor_count then
        v_discount_for_vendor:=greatest(0, v_discount_total-v_allocated_discount);
      else
        v_discount_for_vendor:=round(v_discount_total*v_vendor_eligible_subtotal/v_eligible_total,2);
        v_discount_for_vendor:=least(v_discount_for_vendor,v_vendor_eligible_subtotal);
        v_allocated_discount:=v_allocated_discount+v_discount_for_vendor;
      end if;
    else
      v_discount_for_vendor:=0;
    end if;

    update public.orders set subtotal_iqd=v_vendor_subtotal,discount_iqd=v_discount_for_vendor,total_iqd=v_vendor_subtotal-v_discount_for_vendor where id=v_order_id;
    v_total_subtotal:=v_total_subtotal+v_vendor_subtotal;
    v_total_discount:=v_total_discount+v_discount_for_vendor;
  end loop;

  delete from public.cart_items where user_id=v_user_id;

  update public.checkout_sessions
  set status='submitted',subtotal_iqd=v_total_subtotal,discount_iqd=v_total_discount,total_iqd=v_total_subtotal-v_total_discount
  where id=v_session.id
  returning * into v_session;

  return jsonb_build_object(
    'checkout_session_id',v_session.id,'status',v_session.status,
    'order_ids',coalesce((select jsonb_agg(o.id order by o.created_at) from public.orders o where o.checkout_session_id=v_session.id),'[]'::jsonb),
    'order_numbers',coalesce((select jsonb_agg(o.order_number order by o.created_at) from public.orders o where o.checkout_session_id=v_session.id),'[]'::jsonb),
    'total_iqd',v_session.total_iqd,'subtotal_iqd',v_session.subtotal_iqd,'discount_iqd',v_session.discount_iqd,
    'promotion_id',v_session.promotion_id,'coupon_id',v_session.coupon_id,'coupon_code',v_session.coupon_code,
    'payment_method',p_payment_method
  );
end;
$$;
revoke all on function private.create_orders_from_cart(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.create_orders_from_cart(uuid,text,text,text) to authenticated;

create or replace function private.create_orders_from_cart(
  p_address_id uuid,p_payment_method text,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$ begin return private.create_orders_from_cart(p_address_id,p_payment_method,p_idempotency_key,null); end; $$;
revoke all on function private.create_orders_from_cart(uuid,text,text) from public,anon,authenticated;
grant execute on function private.create_orders_from_cart(uuid,text,text) to authenticated;

create or replace function public.create_orders_from_cart(
  p_address_id uuid,p_payment_method text,p_idempotency_key text,p_coupon_code text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.create_orders_from_cart(p_address_id,p_payment_method,p_idempotency_key,p_coupon_code); end; $$;
revoke all on function public.create_orders_from_cart(uuid,text,text,text) from public,anon;
grant execute on function public.create_orders_from_cart(uuid,text,text,text) to authenticated;

create or replace function public.create_orders_from_cart(
  p_address_id uuid,p_payment_method text,p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.create_orders_from_cart(p_address_id,p_payment_method,p_idempotency_key,null); end; $$;
revoke all on function public.create_orders_from_cart(uuid,text,text) from public,anon;
grant execute on function public.create_orders_from_cart(uuid,text,text) to authenticated;

create or replace function private.checkout_and_initialize_payment(
  p_address_id uuid,p_payment_method text,p_idempotency_key text,p_coupon_code text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$
declare v_checkout jsonb; v_session_id uuid; v_payment jsonb;
begin
  v_checkout:=private.create_orders_from_cart(p_address_id,p_payment_method,p_idempotency_key,p_coupon_code);
  v_session_id:=(v_checkout->>'checkout_session_id')::uuid;
  v_payment:=private.create_payment_intent_for_checkout(v_session_id,trim(p_idempotency_key)||':payment');
  return v_checkout || jsonb_build_object('payment',v_payment);
end;
$$;
revoke all on function private.checkout_and_initialize_payment(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.checkout_and_initialize_payment(uuid,text,text,text) to authenticated;

create or replace function private.checkout_and_initialize_payment(
  p_address_id uuid,p_payment_method text,p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private,extensions
as $$ begin return private.checkout_and_initialize_payment(p_address_id,p_payment_method,p_idempotency_key,null); end; $$;
revoke all on function private.checkout_and_initialize_payment(uuid,text,text) from public,anon,authenticated;
grant execute on function private.checkout_and_initialize_payment(uuid,text,text) to authenticated;

create or replace function public.checkout_and_initialize_payment(
  p_address_id uuid,p_payment_method text,p_idempotency_key text,p_coupon_code text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.checkout_and_initialize_payment(p_address_id,p_payment_method,p_idempotency_key,p_coupon_code); end; $$;
revoke all on function public.checkout_and_initialize_payment(uuid,text,text,text) from public,anon;
grant execute on function public.checkout_and_initialize_payment(uuid,text,text,text) to authenticated;

create or replace function public.checkout_and_initialize_payment(
  p_address_id uuid,p_payment_method text,p_idempotency_key text
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.checkout_and_initialize_payment(p_address_id,p_payment_method,p_idempotency_key,null); end; $$;
revoke all on function public.checkout_and_initialize_payment(uuid,text,text) from public,anon;
grant execute on function public.checkout_and_initialize_payment(uuid,text,text) to authenticated;

-- Redemptions are immutable evidence of usage.
create or replace function private.block_redemption_mutation()
returns trigger
language plpgsql
set search_path=pg_catalog,public,private
as $$ begin raise exception 'coupon_redemption_immutable' using errcode='P0001'; end; $$;
revoke all on function private.block_redemption_mutation() from public,anon,authenticated;

drop trigger if exists coupon_redemptions_immutable on public.coupon_redemptions;
create trigger coupon_redemptions_immutable
before update or delete on public.coupon_redemptions
for each row execute function private.block_redemption_mutation();

