-- SHAKH Phase 23 — Delivery Zones + Dynamic Pricing + Dispatch Rules
-- Idempotent source migration. Requires Phases 9-22.

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name_ckb text not null, name_ar text not null, name_en text not null,
  city text not null, district text,
  center_latitude double precision, center_longitude double precision,
  radius_km numeric(10,2) not null default 5 check (radius_km > 0),
  priority integer not null default 0 check (priority >= 0),
  base_fee_iqd numeric(14,2) not null default 0 check (base_fee_iqd >= 0),
  included_km numeric(10,2) not null default 0 check (included_km >= 0),
  per_km_fee_iqd numeric(14,2) not null default 0 check (per_km_fee_iqd >= 0),
  min_fee_iqd numeric(14,2) not null default 0 check (min_fee_iqd >= 0),
  max_fee_iqd numeric(14,2),
  surge_multiplier numeric(8,3) not null default 1 check (surge_multiplier >= 1),
  free_delivery_threshold_iqd numeric(14,2),
  estimated_base_minutes integer not null default 20 check (estimated_base_minutes >= 0),
  estimated_per_km_minutes numeric(8,2) not null default 4 check (estimated_per_km_minutes >= 0),
  is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint delivery_zones_max_fee_check check (max_fee_iqd is null or max_fee_iqd >= min_fee_iqd),
  constraint delivery_zones_free_threshold_check check (free_delivery_threshold_iqd is null or free_delivery_threshold_iqd >= 0)
);

create table if not exists public.dispatch_rules (
  id uuid primary key default gen_random_uuid(), name_ckb text not null, name_en text not null,
  priority integer not null default 0 check (priority >= 0), vehicle_type text,
  max_pickup_distance_km numeric(10,2), max_location_age_seconds integer not null default 180 check (max_location_age_seconds >= 0),
  min_sla_remaining_minutes integer, require_gps boolean not null default false, allow_no_gps boolean not null default true,
  is_active boolean not null default true, created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint dispatch_rules_distance_check check (max_pickup_distance_km is null or max_pickup_distance_km > 0),
  constraint dispatch_rules_sla_check check (min_sla_remaining_minutes is null or min_sla_remaining_minutes >= 0)
);

alter table public.orders add column if not exists shipping_latitude double precision;
alter table public.orders add column if not exists shipping_longitude double precision;
alter table public.orders add column if not exists delivery_zone_id uuid references public.delivery_zones(id) on delete set null;
alter table public.orders add column if not exists delivery_distance_km numeric(10,2);
alter table public.orders add column if not exists delivery_pricing_status text not null default 'legacy';
alter table public.orders add column if not exists delivery_pricing_snapshot jsonb not null default '{}'::jsonb;

create index if not exists idx_delivery_zones_city_district_active on public.delivery_zones(city,district,is_active,priority desc);
create index if not exists idx_dispatch_rules_active_priority on public.dispatch_rules(is_active,priority desc);
create index if not exists idx_orders_delivery_zone on public.orders(delivery_zone_id);
create index if not exists idx_delivery_zones_created_by on public.delivery_zones(created_by);
create index if not exists idx_dispatch_rules_created_by on public.dispatch_rules(created_by);

grant select,insert,update on public.delivery_zones to authenticated;
grant select,insert,update on public.dispatch_rules to authenticated;

alter table public.delivery_zones enable row level security;
alter table public.dispatch_rules enable row level security;

drop policy if exists "delivery managers read delivery zones" on public.delivery_zones;
create policy "delivery managers read delivery zones" on public.delivery_zones for select to authenticated using ((select private.has_permission('delivery.manage')));
drop policy if exists "delivery managers insert zones" on public.delivery_zones;
create policy "delivery managers insert zones" on public.delivery_zones for insert to authenticated with check ((select private.has_permission('delivery.manage')));
drop policy if exists "delivery managers update zones" on public.delivery_zones;
create policy "delivery managers update zones" on public.delivery_zones for update to authenticated using ((select private.has_permission('delivery.manage'))) with check ((select private.has_permission('delivery.manage')));

drop policy if exists "delivery managers read dispatch rules" on public.dispatch_rules;
create policy "delivery managers read dispatch rules" on public.dispatch_rules for select to authenticated using ((select private.has_permission('delivery.manage')));
drop policy if exists "delivery managers insert dispatch rules" on public.dispatch_rules;
create policy "delivery managers insert dispatch rules" on public.dispatch_rules for insert to authenticated with check ((select private.has_permission('delivery.manage')));
drop policy if exists "delivery managers update dispatch rules" on public.dispatch_rules;
create policy "delivery managers update dispatch rules" on public.dispatch_rules for update to authenticated using ((select private.has_permission('delivery.manage'))) with check ((select private.has_permission('delivery.manage')));

create or replace function private.calculate_delivery_quote_core(p_vendor_id uuid,p_city text,p_district text,p_latitude double precision,p_longitude double precision,p_subtotal_iqd numeric)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_zone public.delivery_zones%rowtype; v_distance numeric; v_fee numeric:=0; v_estimated integer; v_status text:='unconfigured'; v_match text:='none'; v_vendor_lat double precision; v_vendor_lng double precision; v_has_zone boolean:=false;
begin
select latitude,longitude into v_vendor_lat,v_vendor_lng from public.vendors where id=p_vendor_id;
if p_latitude is not null and p_longitude is not null and v_vendor_lat is not null and v_vendor_lng is not null then v_distance:=round((6371*acos(least(1.0,greatest(-1.0,cos(radians(v_vendor_lat))*cos(radians(p_latitude))*cos(radians(p_longitude)-radians(v_vendor_lng))+sin(radians(v_vendor_lat))*sin(radians(p_latitude))))))::numeric,2); end if;
select * into v_zone from public.delivery_zones z where z.is_active=true and lower(trim(z.city))=lower(trim(coalesce(p_city,''))) and (z.district is null or lower(trim(z.district))=lower(trim(coalesce(p_district,'')))) and (z.center_latitude is null or z.center_longitude is null or p_latitude is null or p_longitude is null or 6371*acos(least(1.0,greatest(-1.0,cos(radians(z.center_latitude))*cos(radians(p_latitude))*cos(radians(p_longitude)-radians(z.center_longitude))+sin(radians(z.center_latitude))*sin(radians(p_latitude))))) <= z.radius_km) order by z.priority desc,case when z.district is null then 1 else 0 end,z.radius_km asc,z.updated_at desc limit 1;
v_has_zone:=found;
if v_has_zone then
  v_status:='quoted'; v_match:=case when v_zone.district is null then 'city' when v_distance is null then 'district' else 'district_and_radius' end;
  if v_zone.free_delivery_threshold_iqd is not null and coalesce(p_subtotal_iqd,0)>=v_zone.free_delivery_threshold_iqd then v_fee:=0; else v_fee:=(v_zone.base_fee_iqd+greatest(coalesce(v_distance,0)-v_zone.included_km,0)*v_zone.per_km_fee_iqd)*v_zone.surge_multiplier; v_fee:=greatest(v_fee,v_zone.min_fee_iqd); if v_zone.max_fee_iqd is not null then v_fee:=least(v_fee,v_zone.max_fee_iqd); end if; v_fee:=round(v_fee,0); end if;
  v_estimated:=round(v_zone.estimated_base_minutes+greatest(coalesce(v_distance,0),0)*v_zone.estimated_per_km_minutes);
elsif exists(select 1 from public.delivery_zones where is_active=true) then v_status:='outside_zone'; end if;
return jsonb_build_object('status',v_status,'zone_id',case when v_has_zone then v_zone.id else null end,'zone_code',case when v_has_zone then v_zone.code else null end,'zone_name_ckb',case when v_has_zone then v_zone.name_ckb else null end,'distance_km',v_distance,'fee_iqd',v_fee,'estimated_minutes',v_estimated,'match_method',v_match,'vendor_id',p_vendor_id);
end; $$;
revoke all on function private.calculate_delivery_quote_core(uuid,text,text,double precision,double precision,numeric) from public,anon,authenticated;

create or replace function private.enforce_order_delivery_pricing() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_address public.addresses%rowtype; v_quote jsonb;
begin
if tg_op='INSERT' then select a.* into v_address from public.addresses a join public.checkout_sessions cs on cs.address_id=a.id where cs.id=new.checkout_session_id and a.user_id=new.buyer_user_id limit 1; if found then new.shipping_latitude:=v_address.latitude; new.shipping_longitude:=v_address.longitude; end if; end if;
v_quote:=private.calculate_delivery_quote_core(new.vendor_id,new.shipping_city,new.shipping_district,new.shipping_latitude,new.shipping_longitude,coalesce(new.subtotal_iqd,0));
new.delivery_zone_id:=nullif(v_quote->>'zone_id','')::uuid; new.delivery_distance_km:=nullif(v_quote->>'distance_km','')::numeric; new.delivery_pricing_status:=coalesce(v_quote->>'status','unconfigured'); new.delivery_pricing_snapshot:=v_quote; new.delivery_fee_iqd:=greatest(coalesce((v_quote->>'fee_iqd')::numeric,0),0); new.total_iqd:=greatest(coalesce(new.subtotal_iqd,0)+new.delivery_fee_iqd-greatest(coalesce(new.discount_iqd,0),0),0);
return new; end; $$;
drop trigger if exists orders_delivery_pricing_enforce on public.orders;
create trigger orders_delivery_pricing_enforce before insert or update of subtotal_iqd,discount_iqd,shipping_city,shipping_district,shipping_latitude,shipping_longitude,vendor_id on public.orders for each row execute function private.enforce_order_delivery_pricing();
revoke all on function private.enforce_order_delivery_pricing() from public,anon,authenticated;

create or replace function private.sync_checkout_delivery_totals() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_session_id uuid:=coalesce(new.checkout_session_id,old.checkout_session_id);
begin update public.checkout_sessions cs set delivery_fee_iqd=coalesce((select sum(o.delivery_fee_iqd) from public.orders o where o.checkout_session_id=v_session_id),0),total_iqd=greatest(coalesce((select sum(o.subtotal_iqd+o.delivery_fee_iqd-o.discount_iqd) from public.orders o where o.checkout_session_id=v_session_id),0),0),subtotal_iqd=coalesce((select sum(o.subtotal_iqd) from public.orders o where o.checkout_session_id=v_session_id),0),discount_iqd=coalesce((select sum(o.discount_iqd) from public.orders o where o.checkout_session_id=v_session_id),0),updated_at=now() where cs.id=v_session_id; return coalesce(new,old); end; $$;
drop trigger if exists orders_delivery_totals_sync on public.orders;
create trigger orders_delivery_totals_sync after insert or update of subtotal_iqd,discount_iqd,delivery_fee_iqd on public.orders for each row execute function private.sync_checkout_delivery_totals();
revoke all on function private.sync_checkout_delivery_totals() from public,anon,authenticated;

create or replace function private.get_cart_delivery_quote(p_address_id uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=auth.uid(); v_address public.addresses%rowtype; v_quotes jsonb:='[]'::jsonb; v_total numeric:=0; v_subtotal numeric:=0; v_vendor record; v_quote jsonb; v_serviceable boolean:=true; v_configured boolean:=exists(select 1 from public.delivery_zones where is_active=true);
begin
if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
select * into v_address from public.addresses where id=p_address_id and user_id=v_user_id; if not found then raise exception 'address_not_found' using errcode='P0001'; end if;
for v_vendor in select p.vendor_id,v.name_ckb vendor_name,sum(ci.quantity*pv.price_iqd)::numeric vendor_subtotal from public.cart_items ci join public.product_variants pv on pv.id=ci.variant_id join public.products p on p.id=pv.product_id join public.vendors v on v.id=p.vendor_id where ci.user_id=v_user_id group by p.vendor_id,v.name_ckb order by p.vendor_id loop
  v_subtotal:=v_subtotal+v_vendor.vendor_subtotal; v_quote:=private.calculate_delivery_quote_core(v_vendor.vendor_id,v_address.city,v_address.district,v_address.latitude,v_address.longitude,v_vendor.vendor_subtotal); v_total:=v_total+coalesce((v_quote->>'fee_iqd')::numeric,0); if v_quote->>'status'='outside_zone' then v_serviceable:=false; end if; v_quotes:=v_quotes||jsonb_build_array(v_quote||jsonb_build_object('vendor_name',v_vendor.vendor_name,'subtotal_iqd',v_vendor.vendor_subtotal));
end loop;
return jsonb_build_object('address_id',v_address.id,'city',v_address.city,'district',v_address.district,'subtotal_iqd',v_subtotal,'delivery_fee_iqd',v_total,'quotes',v_quotes,'configured',v_configured,'serviceable',v_serviceable); end; $$;
create or replace function public.get_cart_delivery_quote(p_address_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_cart_delivery_quote(p_address_id); $$;
revoke all on function private.get_cart_delivery_quote(uuid) from public,anon,authenticated; revoke all on function public.get_cart_delivery_quote(uuid) from public,anon; grant execute on function public.get_cart_delivery_quote(uuid) to authenticated;

create or replace function private.get_delivery_pricing_admin() returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin if not private.has_permission('delivery.manage') then raise exception 'delivery_permission_required' using errcode='P0001'; end if; return jsonb_build_object('zones',coalesce((select jsonb_agg(to_jsonb(z) order by z.priority desc,z.city,z.district nulls first) from public.delivery_zones z),'[]'::jsonb),'rules',coalesce((select jsonb_agg(to_jsonb(r) order by r.priority desc,r.name_en) from public.dispatch_rules r),'[]'::jsonb)); end; $$;
create or replace function public.get_delivery_pricing_admin() returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_delivery_pricing_admin(); $$;
revoke all on function private.get_delivery_pricing_admin() from public,anon,authenticated; revoke all on function public.get_delivery_pricing_admin() from public,anon; grant execute on function public.get_delivery_pricing_admin() to authenticated;

create or replace function private.get_dispatch_captain_recommendations_v23(p_order_id uuid,p_limit integer default 8) returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_limit integer:=greatest(least(coalesce(p_limit,8),25),1); v_lat double precision; v_lng double precision; v_rule public.dispatch_rules%rowtype; v_remaining integer;
begin
if not private.has_permission('delivery.manage') then raise exception 'delivery_permission_required' using errcode='P0001'; end if;
select shipping_latitude,shipping_longitude into v_lat,v_lng from public.orders where id=p_order_id;
select * into v_rule from public.dispatch_rules where is_active=true order by priority desc,updated_at desc limit 1;
select case when da.id is null then ceil(extract(epoch from((o.created_at+interval '10 minutes')-clock_timestamp()))/60)::integer else (private.get_delivery_sla(o.created_at,da.status,da.assigned_at,da.accepted_at,da.picked_up_at,da.estimated_minutes)->>'remaining_minutes')::integer end into v_remaining from public.orders o left join public.delivery_assignments da on da.order_id=o.id where o.id=p_order_id;
return coalesce((select jsonb_agg(to_jsonb(q) order by q.rank) from (
select cp.user_id,cp.captain_code,cp.status,cp.vehicle_type,cp.vehicle_make,cp.vehicle_model,cp.vehicle_plate,cll.latitude location_latitude,cll.longitude location_longitude,cll.recorded_at,
case when cll.latitude is null or cll.longitude is null or v_lat is null or v_lng is null then null else round((6371*acos(least(1.0,greatest(-1.0,cos(radians(v_lat))*cos(radians(cll.latitude))*cos(radians(cll.longitude)-radians(v_lng))+sin(radians(v_lat))*sin(radians(cll.latitude))))))::numeric,2) end distance_to_pickup_km,
case when cll.recorded_at is null then null else greatest(0,floor(extract(epoch from(clock_timestamp()-cll.recorded_at)))::integer) end location_age_seconds,
(case when cll.latitude is null or cll.longitude is null or v_lat is null or v_lng is null then 9999 else round((6371*acos(least(1.0,greatest(-1.0,cos(radians(v_lat))*cos(radians(cll.latitude))*cos(radians(cll.longitude)-radians(v_lng))+sin(radians(v_lat))*sin(radians(cll.latitude))))))::numeric,2) end*10)+(case when cll.recorded_at is null then 999999 else greatest(0,floor(extract(epoch from(clock_timestamp()-cll.recorded_at)))::integer) end)/100.0+case when v_rule.vehicle_type is null or cp.vehicle_type=v_rule.vehicle_type then 0 else 10000 end rank
from public.captain_profiles cp left join public.captain_live_locations cll on cll.captain_user_id=cp.user_id
where cp.is_verified=true and cp.status='available'
and not exists(select 1 from public.delivery_assignments da where da.captain_user_id=cp.user_id and da.status in('assigned','accepted','at_pickup','picked_up','out_for_delivery'))
and (v_rule.vehicle_type is null or cp.vehicle_type=v_rule.vehicle_type)
and (v_rule.max_pickup_distance_km is null or v_lat is null or v_lng is null or cll.latitude is null or cll.longitude is null or 6371*acos(least(1.0,greatest(-1.0,cos(radians(v_lat))*cos(radians(cll.latitude))*cos(radians(cll.longitude)-radians(v_lng))+sin(radians(v_lat))*sin(radians(cll.latitude))))) <= v_rule.max_pickup_distance_km)
and (v_rule.require_gps=false or (cll.latitude is not null and cll.longitude is not null))
and (v_rule.allow_no_gps=true or (cll.latitude is not null and cll.longitude is not null))
and (cll.recorded_at is null or greatest(0,floor(extract(epoch from(clock_timestamp()-cll.recorded_at)))::integer) <= v_rule.max_location_age_seconds)
and (v_rule.min_sla_remaining_minutes is null or v_remaining is null or v_remaining>=v_rule.min_sla_remaining_minutes)
order by rank,cp.updated_at asc limit v_limit) q),'[]'::jsonb); end; $$;
revoke all on function private.get_dispatch_captain_recommendations_v23(uuid,integer) from public,anon,authenticated;
create or replace function public.get_dispatch_captain_recommendations(p_order_id uuid,p_limit integer default 8) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_dispatch_captain_recommendations_v23(p_order_id,p_limit); $$;
revoke all on function public.get_dispatch_captain_recommendations(uuid,integer) from public,anon; grant execute on function public.get_dispatch_captain_recommendations(uuid,integer) to authenticated;

create or replace function private.assign_captain_to_order(p_order_id uuid,p_captain_user_id uuid,p_delivery_fee_iqd numeric default 0,p_estimated_minutes integer default null,p_notes text default null)
returns public.delivery_assignments language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_order public.orders%rowtype; v_captain public.captain_profiles%rowtype; v_assignment public.delivery_assignments%rowtype; v_admin uuid:=auth.uid(); v_dropoff_lat double precision; v_dropoff_lng double precision; v_pickup_lat double precision; v_pickup_lng double precision; v_delivery_fee numeric; v_eta integer;
begin
if not private.has_permission('delivery.manage') then raise exception 'delivery_permission_required' using errcode='P0001'; end if;
select * into v_order from public.orders where id=p_order_id for update; if not found then raise exception 'order_not_found' using errcode='P0001'; end if;
if v_order.status in('cancelled','refunded','delivered') then raise exception 'order_not_assignable' using errcode='P0001'; end if;
v_delivery_fee:=case when coalesce(p_delivery_fee_iqd,0)>0 then greatest(p_delivery_fee_iqd,0) else greatest(coalesce(v_order.delivery_fee_iqd,0),0) end;
v_eta:=coalesce(p_estimated_minutes,nullif(v_order.delivery_pricing_snapshot->>'estimated_minutes','')::integer);
select * into v_captain from public.captain_profiles where user_id=p_captain_user_id for update; if not found then raise exception 'captain_not_found' using errcode='P0001'; end if;
if not v_captain.is_verified or v_captain.status in('suspended','busy') then raise exception 'captain_not_available' using errcode='P0001'; end if;
if exists(select 1 from public.delivery_assignments da where da.captain_user_id=p_captain_user_id and da.status in('assigned','accepted','at_pickup','picked_up','out_for_delivery')) then raise exception 'captain_has_active_assignment' using errcode='P0001'; end if;
select da.* into v_assignment from public.delivery_assignments da where da.order_id=p_order_id for update; if found and v_assignment.status not in('unassigned','cancelled','failed') then raise exception 'order_already_assigned' using errcode='P0001'; end if;
select latitude,longitude into v_pickup_lat,v_pickup_lng from public.vendors where id=v_order.vendor_id;
select a.latitude,a.longitude into v_dropoff_lat,v_dropoff_lng from public.addresses a where a.id=(select cs.address_id from public.checkout_sessions cs where cs.id=v_order.checkout_session_id);
if found then update public.delivery_assignments set captain_user_id=p_captain_user_id,assigned_by=v_admin,status='assigned',pickup_latitude=v_pickup_lat,pickup_longitude=v_pickup_lng,dropoff_latitude=v_dropoff_lat,dropoff_longitude=v_dropoff_lng,delivery_fee_iqd=v_delivery_fee,estimated_minutes=v_eta,notes=p_notes,assigned_at=now(),updated_at=now() where id=v_assignment.id returning * into v_assignment;
else insert into public.delivery_assignments(order_id,captain_user_id,assigned_by,status,pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,delivery_fee_iqd,estimated_minutes,notes,assigned_at) values(v_order.id,p_captain_user_id,v_admin,'assigned',v_pickup_lat,v_pickup_lng,v_dropoff_lat,v_dropoff_lng,v_delivery_fee,v_eta,p_notes,now()) returning * into v_assignment; end if;
update public.captain_profiles set status='busy',updated_at=now() where user_id=p_captain_user_id; update public.orders set status=case when status='placed' then 'confirmed' else status end,updated_at=now() where id=v_order.id;
insert into public.delivery_events(assignment_id,order_id,actor_user_id,event_type,note,metadata) values(v_assignment.id,v_order.id,v_admin,'assigned',p_notes,jsonb_build_object('delivery_fee_iqd',v_delivery_fee,'estimated_minutes',v_eta,'pricing_status',v_order.delivery_pricing_status)); return v_assignment; end; $$;
revoke all on function private.assign_captain_to_order(uuid,uuid,numeric,integer,text) from public,anon,authenticated;

create or replace function private.set_delivery_pricing_updated_at() returns trigger language plpgsql security invoker set search_path=pg_catalog as $$ begin new.updated_at:=now(); return new; end; $$;
revoke all on function private.set_delivery_pricing_updated_at() from public,anon,authenticated;
drop trigger if exists delivery_zones_updated_at on public.delivery_zones; create trigger delivery_zones_updated_at before update on public.delivery_zones for each row execute function private.set_delivery_pricing_updated_at();
drop trigger if exists dispatch_rules_updated_at on public.dispatch_rules; create trigger dispatch_rules_updated_at before update on public.dispatch_rules for each row execute function private.set_delivery_pricing_updated_at();

create or replace function private.audit_delivery_pricing_config() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$ begin insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(auth.uid(),case when tg_op='INSERT' then 'delivery_pricing_created' else 'delivery_pricing_updated' end,tg_table_name,coalesce(new.id,old.id),jsonb_build_object('operation',tg_op,'table',tg_table_name)); return coalesce(new,old); end; $$;
revoke all on function private.audit_delivery_pricing_config() from public,anon,authenticated;
drop trigger if exists delivery_zones_audit on public.delivery_zones; create trigger delivery_zones_audit after insert or update on public.delivery_zones for each row execute function private.audit_delivery_pricing_config();
drop trigger if exists dispatch_rules_audit on public.dispatch_rules; create trigger dispatch_rules_audit after insert or update on public.dispatch_rules for each row execute function private.audit_delivery_pricing_config();

-- Checkout guard: re-derive session delivery totals from persisted order snapshots.
-- This prevents legacy checkout code paths from overwriting delivery fees after order creation.
create or replace function private.enforce_checkout_delivery_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_order_count integer;
  v_delivery_fee numeric(14,2);
  v_subtotal numeric(14,2);
  v_discount numeric(14,2);
  v_total numeric(14,2);
begin
  select count(*),
         coalesce(sum(o.subtotal_iqd),0),
         coalesce(sum(o.discount_iqd),0),
         coalesce(sum(o.delivery_fee_iqd),0),
         coalesce(sum(o.total_iqd),0)
    into v_order_count,v_subtotal,v_discount,v_delivery_fee,v_total
  from public.orders o
  where o.checkout_session_id = new.id;

  if v_order_count > 0 then
    new.subtotal_iqd := v_subtotal;
    new.discount_iqd := v_discount;
    new.delivery_fee_iqd := v_delivery_fee;
    new.total_iqd := v_total;
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_checkout_delivery_totals() from public, anon, authenticated;
drop trigger if exists checkout_sessions_delivery_totals_enforce on public.checkout_sessions;
create trigger checkout_sessions_delivery_totals_enforce
before update of subtotal_iqd,discount_iqd,delivery_fee_iqd,total_iqd
on public.checkout_sessions
for each row execute function private.enforce_checkout_delivery_totals();
