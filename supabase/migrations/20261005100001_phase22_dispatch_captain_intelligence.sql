create or replace function private.get_dispatch_captain_recommendations(p_order_id uuid,p_limit integer default 8)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_limit integer:=greatest(least(coalesce(p_limit,8),25),1); v_lat double precision; v_lng double precision;
begin
 if not private.has_permission('delivery.manage') then raise exception 'delivery_permission_required' using errcode='P0001'; end if;
 select v.latitude,v.longitude into v_lat,v_lng from public.orders o join public.vendors v on v.id=o.vendor_id where o.id=p_order_id;
 if v_lat is null or v_lng is null then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(to_jsonb(q) order by q.rank) from (
  select cp.user_id,cp.captain_code,cp.status,cp.vehicle_type,cp.vehicle_make,cp.vehicle_model,cp.vehicle_plate,
    cll.latitude location_latitude,cll.longitude location_longitude,cll.recorded_at,
    case when cll.latitude is null or cll.longitude is null then null else round((6371*acos(least(1.0,greatest(-1.0,cos(radians(v_lat))*cos(radians(cll.latitude))*cos(radians(cll.longitude)-radians(v_lng))+sin(radians(v_lat))*sin(radians(cll.latitude))))))::numeric,2) end distance_to_pickup_km,
    case when cll.recorded_at is null then null else greatest(0,floor(extract(epoch from(clock_timestamp()-cll.recorded_at)))::integer) end location_age_seconds,
    (case when cll.latitude is null or cll.longitude is null then 9999 else round((6371*acos(least(1.0,greatest(-1.0,cos(radians(v_lat))*cos(radians(cll.latitude))*cos(radians(cll.longitude)-radians(v_lng))+sin(radians(v_lat))*sin(radians(cll.latitude))))))::numeric,2) end)*10+
    case when cll.recorded_at is null then 999999 else greatest(0,floor(extract(epoch from(clock_timestamp()-cll.recorded_at)))::integer) end+
    case when cll.recorded_at is null then 100000 else 0 end as rank
  from public.captain_profiles cp left join public.captain_live_locations cll on cll.captain_user_id=cp.user_id
  where cp.is_verified=true and cp.status='available'
    and not exists(select 1 from public.delivery_assignments da where da.captain_user_id=cp.user_id and da.status in('assigned','accepted','at_pickup','picked_up','out_for_delivery'))
  order by rank,cp.updated_at asc limit v_limit
 ) q),'[]'::jsonb);
end; $$;
create or replace function public.get_dispatch_captain_recommendations(p_order_id uuid,p_limit integer default 8)
returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_dispatch_captain_recommendations(p_order_id,p_limit); $$;
revoke all on function private.get_dispatch_captain_recommendations(uuid,integer) from public,anon,authenticated;
revoke all on function public.get_dispatch_captain_recommendations(uuid,integer) from public,anon;
grant execute on function public.get_dispatch_captain_recommendations(uuid,integer) to authenticated;
