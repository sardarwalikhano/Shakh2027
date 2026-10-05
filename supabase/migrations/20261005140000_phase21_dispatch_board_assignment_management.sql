-- SHAKH Phase 21
-- Captain Operations + Dispatch Board + Realtime Assignment Management
-- Security: captain must never hold delivery.manage; dispatch is operations-only.

revoke all on function public.get_dispatch_board(integer) from public, anon, authenticated;
revoke all on function public.reassign_delivery_assignment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.release_delivery_assignment(uuid, text) from public, anon, authenticated;

-- Captain role is a driver role, not an operations/dispatch role.
delete from public.role_permissions
where role_code = 'captain'
  and permission_code = 'delivery.manage';

create index if not exists idx_delivery_assignments_captain_status_updated
  on public.delivery_assignments (captain_user_id, status, updated_at desc);

create index if not exists idx_delivery_assignments_status_updated
  on public.delivery_assignments (status, updated_at desc);

create index if not exists idx_orders_dispatch_status_created
  on public.orders (status, created_at asc);

create or replace function private.get_dispatch_board(p_limit integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_limit integer := greatest(least(coalesce(p_limit, 60), 200), 1);
begin
  if not private.has_permission('delivery.manage') then
    raise exception 'delivery_permission_required' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'generated_at', clock_timestamp(),
    'metrics', (
      select jsonb_build_object(
        'unassigned_orders', count(*) filter (
          where da.id is null or da.status in ('unassigned','failed','cancelled')
        ),
        'assigned_orders', count(*) filter (where da.status in ('assigned','accepted')),
        'active_deliveries', count(*) filter (where da.status in ('at_pickup','picked_up','out_for_delivery')),
        'queued_orders', count(*),
        'available_captains', (select count(*) from public.captain_profiles cp where cp.is_verified = true and cp.status = 'available'),
        'busy_captains', (select count(*) from public.captain_profiles cp where cp.is_verified = true and cp.status = 'busy'),
        'offline_captains', (select count(*) from public.captain_profiles cp where cp.is_verified = true and cp.status = 'offline'),
        'suspended_captains', (select count(*) from public.captain_profiles cp where cp.is_verified = true and cp.status = 'suspended'),
        'stale_active_captains', (
          select count(*)
          from public.captain_profiles cp
          left join public.captain_live_locations cll on cll.captain_user_id = cp.user_id
          where cp.is_verified = true
            and cp.status = 'busy'
            and (cll.recorded_at is null or cll.recorded_at < clock_timestamp() - interval '5 minutes')
        )
      )
      from public.orders o
      left join public.delivery_assignments da on da.order_id = o.id
      where o.status in ('placed','confirmed','processing','ready_for_pickup','out_for_delivery')
    ),
    'orders', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.dispatch_priority asc, q.created_at asc)
      from (
        select
          o.id,
          o.order_number,
          o.status,
          o.payment_status,
          o.payment_method,
          o.total_iqd,
          o.delivery_fee_iqd,
          o.created_at,
          o.shipping_recipient_name as buyer_name,
          o.shipping_phone as buyer_phone,
          o.shipping_city,
          o.shipping_district,
          o.shipping_street,
          o.shipping_landmark,
          o.shipping_notes,
          v.name_ckb as vendor_name,
          case
            when da.id is null or da.status in ('unassigned','failed','cancelled') then 0
            when da.status = 'assigned' then 1
            when da.status = 'accepted' then 2
            else 3
          end as dispatch_priority,
          jsonb_build_object(
            'id', da.id,
            'status', da.status,
            'captain_user_id', da.captain_user_id,
            'captain_code', cp.captain_code,
            'vehicle_type', cp.vehicle_type,
            'vehicle_make', cp.vehicle_make,
            'vehicle_model', cp.vehicle_model,
            'assigned_at', da.assigned_at,
            'accepted_at', da.accepted_at,
            'estimated_minutes', da.estimated_minutes,
            'delivery_fee_iqd', da.delivery_fee_iqd,
            'captain_earning_iqd', da.captain_earning_iqd,
            'pickup', case when da.pickup_latitude is not null and da.pickup_longitude is not null then jsonb_build_object('latitude', da.pickup_latitude, 'longitude', da.pickup_longitude) else null end,
            'dropoff', case when da.dropoff_latitude is not null and da.dropoff_longitude is not null then jsonb_build_object('latitude', da.dropoff_latitude, 'longitude', da.dropoff_longitude) else null end,
            'last_location', case when cll.latitude is not null and cll.longitude is not null then jsonb_build_object(
              'latitude', cll.latitude,
              'longitude', cll.longitude,
              'heading', cll.heading,
              'speed_kmh', cll.speed_kmh,
              'accuracy_m', cll.accuracy_m,
              'recorded_at', cll.recorded_at
            ) else null end
          ) as assignment
        from public.orders o
        join public.vendors v on v.id = o.vendor_id
        left join public.delivery_assignments da on da.order_id = o.id
        left join public.captain_profiles cp on cp.user_id = da.captain_user_id
        left join public.captain_live_locations cll on cll.captain_user_id = da.captain_user_id
        where o.status in ('placed','confirmed','processing','ready_for_pickup','out_for_delivery')
        order by dispatch_priority asc, o.created_at asc
        limit v_limit
      ) q
    ), '[]'::jsonb),
    'captains', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.status_rank asc, q.updated_at asc)
      from (
        select
          cp.user_id,
          cp.captain_code,
          cp.status,
          cp.vehicle_type,
          cp.vehicle_make,
          cp.vehicle_model,
          cp.vehicle_plate,
          cp.is_verified,
          cp.joined_at,
          cp.updated_at,
          da.id as active_assignment_id,
          da.status as active_assignment_status,
          o.order_number as active_order_number,
          case cp.status when 'available' then 0 when 'busy' then 1 when 'offline' then 2 else 3 end as status_rank,
          case when cll.latitude is not null and cll.longitude is not null then jsonb_build_object(
            'latitude', cll.latitude,
            'longitude', cll.longitude,
            'heading', cll.heading,
            'speed_kmh', cll.speed_kmh,
            'accuracy_m', cll.accuracy_m,
            'recorded_at', cll.recorded_at,
            'age_seconds', greatest(0, extract(epoch from (clock_timestamp() - cll.recorded_at))::integer)
          ) else null end as last_location
        from public.captain_profiles cp
        left join lateral (
          select da1.id, da1.order_id, da1.status
          from public.delivery_assignments da1
          where da1.captain_user_id = cp.user_id
            and da1.status in ('assigned','accepted','at_pickup','picked_up','out_for_delivery')
          order by da1.updated_at desc
          limit 1
        ) da on true
        left join public.orders o on o.id = da.order_id
        left join public.captain_live_locations cll on cll.captain_user_id = cp.user_id
        where cp.is_verified = true
      ) q
    ), '[]'::jsonb)
  );
end;
$function$;

create or replace function public.get_dispatch_board(p_limit integer default 60)
returns jsonb
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.get_dispatch_board(p_limit);
$$;

revoke all on function private.get_dispatch_board(integer) from public, anon, authenticated;
revoke all on function public.get_dispatch_board(integer) from public, anon;
grant execute on function public.get_dispatch_board(integer) to authenticated;

create or replace function private.release_delivery_assignment(p_assignment_id uuid, p_note text default null)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_assignment public.delivery_assignments%rowtype;
  v_user_id uuid := auth.uid();
begin
  if not private.has_permission('delivery.manage') then
    raise exception 'delivery_permission_required' using errcode = 'P0001';
  end if;

  select * into v_assignment
  from public.delivery_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0001';
  end if;

  if v_assignment.status <> 'assigned' then
    raise exception 'only_pending_assignment_can_be_released' using errcode = 'P0001';
  end if;

  update public.delivery_assignments
  set status = 'failed',
      failure_reason = coalesce(nullif(trim(p_note), ''), 'dispatch_released'),
      notes = coalesce(nullif(trim(p_note), ''), notes),
      updated_at = now()
  where id = p_assignment_id
  returning * into v_assignment;

  if v_assignment.captain_user_id is not null then
    update public.captain_profiles
    set status = 'available', updated_at = now()
    where user_id = v_assignment.captain_user_id
      and status = 'busy';
  end if;

  insert into public.delivery_events(assignment_id, order_id, actor_user_id, event_type, note, metadata)
  values(v_assignment.id, v_assignment.order_id, v_user_id, 'dispatch_released', p_note, jsonb_build_object('reason', coalesce(p_note, 'dispatch_released')));

  return v_assignment;
end;
$function$;

create or replace function public.release_delivery_assignment(p_assignment_id uuid, p_note text default null)
returns public.delivery_assignments
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.release_delivery_assignment(p_assignment_id, p_note);
$$;

revoke all on function private.release_delivery_assignment(uuid, text) from public, anon, authenticated;
revoke all on function public.release_delivery_assignment(uuid, text) from public, anon;
grant execute on function public.release_delivery_assignment(uuid, text) to authenticated;

create or replace function private.reassign_delivery_assignment(
  p_assignment_id uuid,
  p_new_captain_user_id uuid,
  p_notes text default null
)
returns public.delivery_assignments
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_assignment public.delivery_assignments%rowtype;
  v_old_captain public.captain_profiles%rowtype;
  v_new_captain public.captain_profiles%rowtype;
  v_user_id uuid := auth.uid();
begin
  if not private.has_permission('delivery.manage') then
    raise exception 'delivery_permission_required' using errcode = 'P0001';
  end if;

  if p_new_captain_user_id is null then
    raise exception 'new_captain_required' using errcode = 'P0001';
  end if;

  select * into v_assignment
  from public.delivery_assignments
  where id = p_assignment_id
  for update;

  if not found then
    raise exception 'assignment_not_found' using errcode = 'P0001';
  end if;

  if v_assignment.status <> 'assigned' then
    raise exception 'only_pending_assignment_can_be_reassigned' using errcode = 'P0001';
  end if;

  if v_assignment.captain_user_id = p_new_captain_user_id then
    raise exception 'captain_already_assigned' using errcode = 'P0001';
  end if;

  if v_assignment.captain_user_id is not null then
    select * into v_old_captain
    from public.captain_profiles
    where user_id = v_assignment.captain_user_id
    for update;
  end if;

  select * into v_new_captain
  from public.captain_profiles
  where user_id = p_new_captain_user_id
  for update;

  if not found then
    raise exception 'captain_not_found' using errcode = 'P0001';
  end if;

  if not v_new_captain.is_verified or v_new_captain.status <> 'available' then
    raise exception 'captain_not_available' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.delivery_assignments da
    where da.captain_user_id = p_new_captain_user_id
      and da.id <> v_assignment.id
      and da.status in ('assigned','accepted','at_pickup','picked_up','out_for_delivery')
  ) then
    raise exception 'captain_has_active_assignment' using errcode = 'P0001';
  end if;

  if v_old_captain.user_id is not null then
    update public.captain_profiles
    set status = 'available', updated_at = now()
    where user_id = v_old_captain.user_id;
  end if;

  update public.delivery_assignments
  set captain_user_id = p_new_captain_user_id,
      assigned_by = v_user_id,
      status = 'assigned',
      assigned_at = now(),
      accepted_at = null,
      picked_up_at = null,
      delivered_at = null,
      failure_reason = null,
      notes = coalesce(nullif(trim(p_notes), ''), notes),
      updated_at = now()
  where id = v_assignment.id
  returning * into v_assignment;

  update public.captain_profiles
  set status = 'busy', updated_at = now()
  where user_id = p_new_captain_user_id;

  insert into public.delivery_events(assignment_id, order_id, actor_user_id, event_type, note, metadata)
  values(
    v_assignment.id,
    v_assignment.order_id,
    v_user_id,
    'reassigned',
    p_notes,
    jsonb_build_object('from_captain_user_id', v_old_captain.user_id, 'to_captain_user_id', p_new_captain_user_id)
  );

  return v_assignment;
end;
$function$;

create or replace function public.reassign_delivery_assignment(
  p_assignment_id uuid,
  p_new_captain_user_id uuid,
  p_notes text default null
)
returns public.delivery_assignments
language sql
security invoker
set search_path = pg_catalog, public, private
as $$
  select private.reassign_delivery_assignment(p_assignment_id, p_new_captain_user_id, p_notes);
$$;

revoke all on function private.reassign_delivery_assignment(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.reassign_delivery_assignment(uuid, uuid, text) from public, anon;
grant execute on function public.reassign_delivery_assignment(uuid, uuid, text) to authenticated;

-- Existing public delivery APIs remain invoker wrappers; only broaden Realtime visibility for ops.
alter publication supabase_realtime add table public.captain_profiles;
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.delivery_events;

-- Captain can continue using its own console through captain role checks, but cannot act as dispatch operations.
