-- ---------------------------------------------------------------------------
-- Analytics: append-only event stream + admin aggregation.
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  session_id text,
  event_name text not null check (length(trim(event_name)) between 1 and 80),
  entity_type text check (entity_type is null or length(trim(entity_type)) <= 80),
  entity_id uuid,
  page_path text,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_analytics_events_occurred_at on public.analytics_events(occurred_at desc);
create index if not exists idx_analytics_events_event_name_occurred_at on public.analytics_events(event_name,occurred_at desc);
create index if not exists idx_analytics_events_user_id_occurred_at on public.analytics_events(user_id,occurred_at desc);

alter table public.analytics_events enable row level security;
revoke all on table public.analytics_events from anon,authenticated;

create or replace function private.record_analytics_event(
  p_event_name text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_page_path text default null,
  p_properties jsonb default '{}'::jsonb,
  p_session_id text default null
)
returns uuid
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_id uuid;
begin
  if length(trim(coalesce(p_event_name,'')))=0 or length(trim(p_event_name))>80 then raise exception 'invalid_analytics_event_name' using errcode='P0001'; end if;
  if p_properties is null then p_properties:='{}'::jsonb; end if;
  if jsonb_typeof(p_properties) <> 'object' then raise exception 'analytics_properties_must_be_object' using errcode='P0001'; end if;
  insert into public.analytics_events(user_id,session_id,event_name,entity_type,entity_id,page_path,properties)
  values(auth.uid(),left(trim(p_session_id),160),left(trim(p_event_name),80),nullif(left(trim(coalesce(p_entity_type,'')),80),''),p_entity_id,left(trim(coalesce(p_page_path,'')),300),p_properties)
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function private.record_analytics_event(text,text,uuid,text,jsonb,text) from public,anon,authenticated;
grant execute on function private.record_analytics_event(text,text,uuid,text,jsonb,text) to anon,authenticated;



create or replace function public.record_analytics_event(
  p_event_name text,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_page_path text default null,
  p_properties jsonb default '{}'::jsonb,
  p_session_id text default null
)
returns uuid
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$
begin
  return private.record_analytics_event(p_event_name,p_entity_type,p_entity_id,p_page_path,p_properties,p_session_id);
end;
$$;
revoke all on function public.record_analytics_event(text,text,uuid,text,jsonb,text) from public;
grant execute on function public.record_analytics_event(text,text,uuid,text,jsonb,text) to anon,authenticated;

create or replace function private.get_analytics_overview(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_days integer:=greatest(1,least(coalesce(p_days,30),90));
  v_since timestamptz:=now()-(v_days||' days')::interval;
  v_result jsonb;
  v_events bigint;
  v_users bigint;
  v_views bigint;
  v_cart_adds bigint;
  v_checkouts bigint;
  v_orders bigint;
  v_delivered bigint;
  v_payments bigint;
  v_coupons bigint;
  v_revenue numeric(14,2);
  v_top_events jsonb;
begin
  if not private.has_permission('analytics.read') then raise exception 'analytics_permission_required' using errcode='P0001'; end if;

  select count(*), count(distinct user_id),
    count(*) filter (where event_name='product_view'),
    count(*) filter (where event_name='add_to_cart'),
    count(*) filter (where event_name='checkout_started'),
    count(*) filter (where event_name='order_created'),
    count(*) filter (where event_name='order_delivered'),
    count(*) filter (where event_name='payment_succeeded'),
    count(*) filter (where event_name='coupon_redeemed')
  into v_events,v_users,v_views,v_cart_adds,v_checkouts,v_orders,v_delivered,v_payments,v_coupons
  from public.analytics_events
  where occurred_at>=v_since;

  select coalesce(sum(o.total_iqd),0) into v_revenue
  from public.orders o
  where o.payment_status='paid' and o.created_at>=v_since;

  select coalesce(jsonb_agg(jsonb_build_object('event_name',event_name,'count',count) order by count desc),'[]'::jsonb)
  into v_top_events
  from (
    select event_name,count(*) as count from public.analytics_events
    where occurred_at>=v_since group by event_name order by count desc limit 10
  ) x;

  v_result:=jsonb_build_object(
    'days',v_days,'since',v_since,'generated_at',now(),
    'events',v_events,'unique_users',v_users,'product_views',v_views,'add_to_cart',v_cart_adds,
    'checkout_started',v_checkouts,'order_created',v_orders,'order_delivered',v_delivered,
    'payment_succeeded',v_payments,'coupon_redeemed',v_coupons,'paid_revenue_iqd',v_revenue,
    'top_events',v_top_events,
    'conversion',jsonb_build_object(
      'view_to_cart_pct',case when v_views=0 then 0 else round(v_cart_adds*100.0/v_views,2) end,
      'cart_to_checkout_pct',case when v_cart_adds=0 then 0 else round(v_checkouts*100.0/v_cart_adds,2) end,
      'checkout_to_order_pct',case when v_checkouts=0 then 0 else round(v_orders*100.0/v_checkouts,2) end,
      'order_to_paid_pct',case when v_orders=0 then 0 else round(v_payments*100.0/v_orders,2) end
    )
  );
  return v_result;
end;
$$;
revoke all on function private.get_analytics_overview(integer) from public,anon,authenticated;
grant execute on function private.get_analytics_overview(integer) to authenticated;

create or replace function public.get_analytics_overview(p_days integer default 30)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private
as $$ begin return private.get_analytics_overview(p_days); end; $$;
revoke all on function public.get_analytics_overview(integer) from public,anon;
grant execute on function public.get_analytics_overview(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Server-side analytics emitted from important state changes.
-- ---------------------------------------------------------------------------

create or replace function private.record_order_analytics_event()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if tg_op='INSERT' then
    perform private.record_analytics_event('order_created','order',new.id,null,jsonb_build_object('status',new.status,'payment_method',new.payment_method),null);
  elsif new.status is distinct from old.status and new.status='delivered' then
    perform private.record_analytics_event('order_delivered','order',new.id,null,jsonb_build_object('total_iqd',new.total_iqd),null);
  elsif new.payment_status is distinct from old.payment_status and new.payment_status='paid' then
    perform private.record_analytics_event('payment_succeeded','order',new.id,null,jsonb_build_object('total_iqd',new.total_iqd),null);
  end if;
  return new;
end;
$$;
revoke all on function private.record_order_analytics_event() from public,anon,authenticated;

drop trigger if exists orders_analytics_events on public.orders;
create trigger orders_analytics_events
after insert or update of status,payment_status on public.orders
for each row execute function private.record_order_analytics_event();

