-- SHAKH 2027 — Compact dashboard order identity
-- Extends the existing operations snapshot with the customer's display name.
-- Existing metrics, permissions, and order fields are preserved.

create or replace function private.get_operations_dashboard_snapshot()
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_has_users boolean := private.has_permission('users.read');
  v_has_catalog boolean := private.has_permission('catalog.read');
  v_has_orders boolean := private.has_permission('orders.read');
  v_has_delivery boolean := private.has_permission('delivery.manage');
  v_has_finance boolean := private.has_permission('finance.read');
  v_has_payments boolean := private.has_permission('payments.read');
  v_has_support boolean := private.has_permission('support.read');
  v_has_events boolean := private.has_permission('events.read');
  v_local_today timestamp := date_trunc('day', timezone('Asia/Baghdad', now()));
  v_utc_today timestamptz := v_local_today at time zone 'Asia/Baghdad';
  v_result jsonb;
begin
  if not (v_has_users or v_has_catalog or v_has_orders or v_has_delivery or v_has_finance or v_has_payments or v_has_support or v_has_events) then
    raise exception 'operations_dashboard_permission_required' using errcode='P0001';
  end if;

  v_result := jsonb_build_object(
    'generated_at', now(),
    'local_timezone', 'Asia/Baghdad',
    'metrics', jsonb_build_object(
      'total_users', case when v_has_users then (select count(*) from public.profiles) else null end,
      'active_users', case when v_has_users then (select count(*) from public.profiles where is_active=true) else null end,
      'total_vendors', case when v_has_catalog then (select count(*) from public.vendors) else null end,
      'active_vendors', case when v_has_catalog then (select count(*) from public.vendors where status='active') else null end,
      'orders_today', case when v_has_orders then (select count(*) from public.orders where created_at >= v_utc_today) else null end,
      'orders_pending', case when v_has_orders then (select count(*) from public.orders where status in ('pending_payment','placed','confirmed','processing','ready_for_pickup')) else null end,
      'orders_delivered_today', case when v_has_orders then (select count(*) from public.orders where status='delivered' and updated_at >= v_utc_today) else null end,
      'gross_paid_today_iqd', case when v_has_finance then (select coalesce(sum(total_iqd),0) from public.orders where payment_status='paid' and created_at >= v_utc_today) else null end,
      'pending_payments', case when v_has_payments then (select count(*) from public.payment_intents where status in ('pending','requires_action')) else null end,
      'failed_payments_24h', case when v_has_payments then (select count(*) from public.payment_intents where status='failed' and created_at >= now()-interval '24 hours') else null end,
      'active_deliveries', case when v_has_delivery then (select count(*) from public.delivery_assignments where status in ('assigned','accepted','at_pickup','picked_up','out_for_delivery')) else null end,
      'unassigned_orders', case when v_has_delivery then (
        select count(*) from public.orders o
        where o.status in ('processing','ready_for_pickup')
          and not exists (
            select 1 from public.delivery_assignments da
            where da.order_id=o.id and da.status in ('assigned','accepted','at_pickup','picked_up','out_for_delivery')
          )
      ) else null end,
      'available_captains', case when v_has_delivery then (select count(*) from public.captain_profiles where status='available' and is_verified=true) else null end,
      'support_open', case when v_has_support then (select count(*) from public.support_tickets where status in ('open','pending_support')) else null end,
      'support_urgent', case when v_has_support then (select count(*) from public.support_tickets where priority='urgent' and status not in ('resolved','closed')) else null end,
      'pending_withdrawals', case when v_has_finance then (select count(*) from public.withdrawals where status in ('requested','approved')) else null end
    ),
    'recent_orders', case when v_has_orders then coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'order_number',x.order_number,'customer_name',x.customer_name,'status',x.status,'payment_status',x.payment_status,'total_iqd',x.total_iqd,'created_at',x.created_at) order by x.created_at desc)
      from (
        select
          o.id,
          o.order_number,
          coalesce(
            nullif(trim(p.full_name), ''),
            nullif(trim(o.shipping_recipient_name), ''),
            'کڕیار'
          ) as customer_name,
          o.status,
          o.payment_status,
          o.total_iqd,
          o.created_at
        from public.orders o
        left join public.profiles p on p.id = o.buyer_user_id
        order by o.created_at desc
        limit 8
      ) x
    ),'[]'::jsonb) else '[]'::jsonb end,
    'recent_events', case when v_has_events then coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'event_type',x.event_type,'entity_type',x.entity_type,'entity_id',x.entity_id,'severity',x.severity,'title_ckb',x.title_ckb,'created_at',x.created_at) order by x.created_at desc)
      from (select pe.id,pe.event_type,pe.entity_type,pe.entity_id,pe.severity,pe.title_ckb,pe.created_at from public.platform_events pe order by pe.created_at desc limit 10) x
    ),'[]'::jsonb) else '[]'::jsonb end,
    'recent_audit', case when private.has_permission('platform.manage') then coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'action',x.action,'entity_type',x.entity_type,'entity_id',x.entity_id,'actor_user_id',x.actor_user_id,'created_at',x.created_at) order by x.created_at desc)
      from (select al.id,al.action,al.entity_type,al.entity_id,al.actor_user_id,al.created_at from public.audit_logs al order by al.created_at desc limit 12) x
    ),'[]'::jsonb) else '[]'::jsonb end,
    'support_queue', case when v_has_support then coalesce((
      select jsonb_agg(jsonb_build_object('id',x.id,'ticket_number',x.ticket_number,'subject',x.subject,'priority',x.priority,'status',x.status,'last_message_at',x.last_message_at) order by x.last_message_at desc)
      from (select st.id,st.ticket_number,st.subject,st.priority,st.status,st.last_message_at from public.support_tickets st where st.status not in ('resolved','closed') order by (st.priority='urgent') desc,(st.priority='high') desc,st.last_message_at desc limit 8) x
    ),'[]'::jsonb) else '[]'::jsonb end
  );
  return v_result;
end;
$$;

revoke all on function private.get_operations_dashboard_snapshot() from public,anon,authenticated;
