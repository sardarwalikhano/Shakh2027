-- SHAKH 2027 Phase 20 — Canonical Order Management + Fulfillment migration

insert into public.role_permissions(role_code,permission_code)
select r.code,p.code
from public.app_roles r cross join public.permissions p
where r.code in ('super_admin','admin','restaurant_vendor','supermarket_vendor','fashion_vendor','car_dealer','umrah_agency','beauty_vendor')
  and p.code in ('orders.read','orders.manage')
on conflict(role_code,permission_code) do nothing;

insert into public.role_permissions(role_code,permission_code)
select r.code,p.code
from public.app_roles r cross join public.permissions p
where r.code in ('support','captain_manager')
  and p.code='orders.read'
on conflict(role_code,permission_code) do nothing;

create index if not exists idx_orders_vendor_status_created on public.orders(vendor_id,status,created_at desc);
create index if not exists idx_orders_buyer_created on public.orders(buyer_user_id,created_at desc);
create index if not exists idx_order_status_history_order_created on public.order_status_history(order_id,created_at desc);

create or replace function private.record_order_status_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history(order_id,status,actor_user_id,note)
    values(new.id,new.status,(select auth.uid()),case when tg_op='INSERT' then 'Order created' else null end);
  end if;
  return new;
end;
$$;
revoke all on function private.record_order_status_history() from public,anon,authenticated;

drop trigger if exists orders_status_history_auto on public.orders;
create trigger orders_status_history_auto
after insert or update of status on public.orders
for each row execute function private.record_order_status_history();

create or replace function private.get_order_details(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=(select auth.uid());
  v_order public.orders%rowtype;
  v_items jsonb; v_history jsonb; v_delivery jsonb; v_result jsonb; v_access boolean:=false;
  v_is_customer_owner boolean:=false; v_is_vendor_owner boolean:=false; v_is_ops boolean:=false;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select * into v_order from public.orders where id=p_order_id for share;
  if not found then raise exception 'order_not_found' using errcode='P0001'; end if;
  v_is_customer_owner:=v_order.buyer_user_id=v_user_id;
  v_is_vendor_owner:=exists(select 1 from public.vendors v where v.id=v_order.vendor_id and v.owner_user_id=v_user_id);
  v_is_ops:=private.has_permission('orders.read');
  v_access:=v_is_customer_owner or v_is_vendor_owner or v_is_ops or exists(
    select 1 from public.delivery_assignments da where da.order_id=v_order.id and da.captain_user_id=v_user_id
  );
  if not v_access then raise exception 'order_access_denied' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb) into v_items
  from (
    select oi.id,oi.product_id,oi.variant_id,oi.vendor_id,oi.sku,oi.product_name_ckb,oi.product_name_ar,oi.product_name_en,
           oi.variant_label_ckb,oi.variant_label_ar,oi.variant_label_en,oi.image_storage_path,oi.unit_price_iqd,oi.quantity,oi.line_total_iqd,oi.created_at
    from public.order_items oi where oi.order_id=v_order.id
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at asc),'[]'::jsonb) into v_history
  from (
    select osh.id,osh.order_id,osh.status,osh.actor_user_id,osh.note,osh.created_at
    from public.order_status_history osh where osh.order_id=v_order.id
  ) x;

  select jsonb_build_object(
    'assignment_id',da.id,'captain_user_id',da.captain_user_id,'status',da.status,'delivery_fee_iqd',da.delivery_fee_iqd,
    'estimated_minutes',da.estimated_minutes,'assigned_at',da.assigned_at,'accepted_at',da.accepted_at,'picked_up_at',da.picked_up_at,
    'delivered_at',da.delivered_at,'failure_reason',da.failure_reason,'updated_at',da.updated_at,
    'captain',case when cp.user_id is null then null else jsonb_build_object(
      'captain_code',cp.captain_code,'vehicle_type',cp.vehicle_type,'vehicle_make',cp.vehicle_make,'vehicle_model',cp.vehicle_model,'status',cp.status
    ) end
  ) into v_delivery
  from public.delivery_assignments da
  left join public.captain_profiles cp on cp.user_id=da.captain_user_id
  where da.order_id=v_order.id
  order by da.created_at desc limit 1;

  v_result:=jsonb_build_object(
    'order',jsonb_build_object(
      'id',v_order.id,'order_number',v_order.order_number,'checkout_session_id',v_order.checkout_session_id,'buyer_user_id',v_order.buyer_user_id,
      'vendor_id',v_order.vendor_id,'payment_method',v_order.payment_method,'payment_status',v_order.payment_status,'status',v_order.status,
      'currency',v_order.currency,'subtotal_iqd',v_order.subtotal_iqd,'delivery_fee_iqd',v_order.delivery_fee_iqd,'discount_iqd',v_order.discount_iqd,
      'total_iqd',v_order.total_iqd,'shipping_recipient_name',v_order.shipping_recipient_name,'shipping_phone',v_order.shipping_phone,
      'shipping_city',v_order.shipping_city,'shipping_district',v_order.shipping_district,'shipping_street',v_order.shipping_street,
      'shipping_landmark',v_order.shipping_landmark,'shipping_notes',v_order.shipping_notes,'promotion_id',v_order.promotion_id,'coupon_id',v_order.coupon_id,
      'coupon_code',v_order.coupon_code,'created_at',v_order.created_at,'updated_at',v_order.updated_at
    ),
    'items',v_items,'status_history',v_history,'delivery',v_delivery,
    'payment',(
      select jsonb_build_object(
        'method',pi.payment_method,'status',pi.status,'provider',pi.provider,'amount_iqd',pi.amount_iqd,
        'provider_reference',case when v_is_customer_owner and not v_is_vendor_owner and not v_is_ops then null else pi.provider_reference end,
        'created_at',pi.created_at
      )
      from public.payment_intents pi
      where pi.order_id=v_order.id or pi.checkout_session_id=v_order.checkout_session_id
      order by pi.created_at desc limit 1
    )
  );
  return v_result;
end;
$$;
revoke all on function private.get_order_details(uuid) from public,anon,authenticated;
grant execute on function private.get_order_details(uuid) to authenticated;

create or replace function public.get_order_details(p_order_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  return private.get_order_details(p_order_id);
end;
$$;
revoke all on function public.get_order_details(uuid) from public,anon;
grant execute on function public.get_order_details(uuid) to authenticated;

create or replace function private.list_customer_orders(p_status text default null,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_user_id uuid:=(select auth.uid()); v_limit integer:=greatest(1,least(coalesce(p_limit,50),100)); v_rows jsonb;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_status is not null and p_status not in ('pending_payment','placed','confirmed','processing','ready_for_pickup','out_for_delivery','delivered','cancelled','refunded') then
    raise exception 'invalid_order_status' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_rows
  from (
    select o.id,o.order_number,o.vendor_id,o.payment_method,o.payment_status,o.status,o.currency,o.subtotal_iqd,o.delivery_fee_iqd,o.discount_iqd,o.total_iqd,o.created_at,o.updated_at,
      v.name_ckb as vendor_name_ckb,v.name_ar as vendor_name_ar,v.name_en as vendor_name_en,v.logo_url,
      (select count(*)::int from public.order_items oi where oi.order_id=o.id) as item_count,
      (select coalesce(sum(oi.quantity),0)::int from public.order_items oi where oi.order_id=o.id) as total_items,
      (select da.status from public.delivery_assignments da where da.order_id=o.id order by da.created_at desc limit 1) as delivery_status
    from public.orders o join public.vendors v on v.id=o.vendor_id
    where o.buyer_user_id=v_user_id and (p_status is null or o.status=p_status)
    order by o.created_at desc limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows,'limit',v_limit);
end;
$$;
revoke all on function private.list_customer_orders(text,integer) from public,anon,authenticated;
grant execute on function private.list_customer_orders(text,integer) to authenticated;

create or replace function public.list_customer_orders(p_status text default null,p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  return private.list_customer_orders(p_status,p_limit);
end;
$$;
revoke all on function public.list_customer_orders(text,integer) from public,anon;
grant execute on function public.list_customer_orders(text,integer) to authenticated;

create or replace function private.list_vendor_orders(p_vendor_id uuid,p_status text default null,p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_limit integer:=greatest(1,least(coalesce(p_limit,100),250)); v_rows jsonb; v_owner uuid;
begin
  select owner_user_id into v_owner from public.vendors where id=p_vendor_id;
  if not found then raise exception 'vendor_not_found' using errcode='P0001'; end if;
  if (select auth.uid())<>v_owner and not private.has_permission('orders.read') then raise exception 'vendor_order_access_denied' using errcode='P0001'; end if;
  if p_status is not null and p_status not in ('pending_payment','placed','confirmed','processing','ready_for_pickup','out_for_delivery','delivered','cancelled','refunded') then raise exception 'invalid_order_status' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_rows
  from (
    select o.id,o.order_number,o.buyer_user_id,o.payment_method,o.payment_status,o.status,o.subtotal_iqd,o.delivery_fee_iqd,o.discount_iqd,o.total_iqd,
      o.shipping_recipient_name,o.shipping_phone,o.shipping_city,o.shipping_district,o.shipping_street,o.shipping_landmark,o.created_at,o.updated_at,
      coalesce(p.full_name,'کڕیار') as buyer_name,
      (select count(*)::int from public.order_items oi where oi.order_id=o.id) as item_count,
      (select coalesce(sum(oi.quantity),0)::int from public.order_items oi where oi.order_id=o.id) as total_items,
      (select jsonb_build_object('status',da.status,'captain_user_id',da.captain_user_id,'estimated_minutes',da.estimated_minutes,'assigned_at',da.assigned_at,'accepted_at',da.accepted_at,'picked_up_at',da.picked_up_at,'delivered_at',da.delivered_at)
       from public.delivery_assignments da where da.order_id=o.id order by da.created_at desc limit 1) as delivery
    from public.orders o left join public.profiles p on p.id=o.buyer_user_id
    where o.vendor_id=p_vendor_id and (p_status is null or o.status=p_status)
    order by o.created_at desc limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows,'vendor_id',p_vendor_id,'limit',v_limit);
end;
$$;
revoke all on function private.list_vendor_orders(uuid,text,integer) from public,anon,authenticated;
grant execute on function private.list_vendor_orders(uuid,text,integer) to authenticated;

create or replace function public.list_vendor_orders(p_vendor_id uuid,p_status text default null,p_limit integer default 100)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  return private.list_vendor_orders(p_vendor_id,p_status,p_limit);
end;
$$;
revoke all on function public.list_vendor_orders(uuid,text,integer) from public,anon;
grant execute on function public.list_vendor_orders(uuid,text,integer) to authenticated;

create or replace function private.update_vendor_order_status(p_order_id uuid,p_next_status text,p_note text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_order public.orders%rowtype; v_vendor public.vendors%rowtype; v_user_id uuid:=(select auth.uid()); v_delivery_status text;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if not private.has_permission('orders.manage') then raise exception 'orders_manage_permission_required' using errcode='P0001'; end if;
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'order_not_found' using errcode='P0001'; end if;
  select * into v_vendor from public.vendors where id=v_order.vendor_id;
  if not found then raise exception 'vendor_not_found' using errcode='P0001'; end if;
  if not private.has_permission('platform.manage') and v_vendor.owner_user_id<>v_user_id then raise exception 'vendor_order_access_denied' using errcode='P0001'; end if;
  if p_next_status not in ('confirmed','processing','ready_for_pickup','cancelled') then raise exception 'vendor_status_not_allowed' using errcode='P0001'; end if;

  case
    when p_next_status='confirmed' then
      if v_order.status<>'placed' then raise exception 'invalid_order_transition' using errcode='P0001'; end if;
      if v_order.payment_method='mobile_cash' and v_order.payment_status<>'paid' then raise exception 'payment_required_before_confirmation' using errcode='P0001'; end if;
    when p_next_status='processing' then
      if v_order.status<>'confirmed' then raise exception 'invalid_order_transition' using errcode='P0001'; end if;
    when p_next_status='ready_for_pickup' then
      if v_order.status<>'processing' then raise exception 'invalid_order_transition' using errcode='P0001'; end if;
    when p_next_status='cancelled' then
      if v_order.status not in ('placed','confirmed','processing') then raise exception 'invalid_order_transition' using errcode='P0001'; end if;
      select da.status into v_delivery_status from public.delivery_assignments da where da.order_id=v_order.id order by da.created_at desc limit 1;
      if v_delivery_status is not null and v_delivery_status not in ('unassigned','failed','cancelled') then raise exception 'order_has_active_delivery' using errcode='P0001'; end if;
  end case;

  update public.orders set status=p_next_status,updated_at=now() where id=v_order.id;
  return jsonb_build_object('order_id',v_order.id,'order_number',v_order.order_number,'status',p_next_status);
end;
$$;
revoke all on function private.update_vendor_order_status(uuid,text,text) from public,anon,authenticated;
grant execute on function private.update_vendor_order_status(uuid,text,text) to authenticated;

create or replace function public.update_vendor_order_status(p_order_id uuid,p_next_status text,p_note text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  return private.update_vendor_order_status(p_order_id,p_next_status,p_note);
end;
$$;
revoke all on function public.update_vendor_order_status(uuid,text,text) from public,anon;
grant execute on function public.update_vendor_order_status(uuid,text,text) to authenticated;
