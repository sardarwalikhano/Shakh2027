-- Auth clean rebuild v2
-- Applied to production as migration auth_clean_rebuild_v2.
-- Preserves Super Admin and all durable business data.
-- Removes only test-only customer identities with no business references.
-- Removes obsolete WhatsApp auth SQL objects.
-- Rebuilds auth/profile/role bootstrap triggers.

create temporary table auth_cleanup_targets on commit drop as
select u.id
from auth.users u
where u.created_at >= timestamptz '2026-10-05 00:00:00+00'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id=u.id and ur.role_code='customer'
  )
  and not exists (
    select 1 from public.user_roles ur2
    where ur2.user_id=u.id and ur2.role_code <> 'customer'
  )
  and not exists (select 1 from public.marketplace_posts mp where mp.created_by=u.id)
  and not exists (select 1 from public.audit_logs al where al.actor_user_id=u.id)
  and not exists (select 1 from public.umrah_booking_fee_rules ubr where ubr.created_by=u.id)
  and not exists (select 1 from public.car_listings cl where cl.seller_user_id=u.id)
  and not exists (select 1 from public.role_applications ra where ra.applicant_user_id=u.id or ra.reviewed_by=u.id)
  and not exists (select 1 from public.promotions pr where pr.created_by=u.id)
  and not exists (select 1 from public.coupon_codes cc where cc.created_by=u.id)
  and not exists (select 1 from public.coupon_redemptions cr where cr.buyer_user_id=u.id)
  and not exists (select 1 from public.analytics_events ae where ae.user_id=u.id)
  and not exists (select 1 from public.favorite_products fp where fp.user_id=u.id)
  and not exists (select 1 from public.product_reviews rv where rv.reviewer_user_id=u.id)
  and not exists (select 1 from public.delivery_events de where de.actor_user_id=u.id)
  and not exists (select 1 from public.delivery_assignments da where da.assigned_by=u.id)
  and not exists (select 1 from public.delivery_zones dz where dz.created_by=u.id)
  and not exists (select 1 from public.dispatch_rules dr where dr.created_by=u.id)
  and not exists (select 1 from public.captain_earning_rules cer where cer.created_by=u.id)
  and not exists (select 1 from public.financial_disputes fd where fd.reported_by=u.id or fd.assigned_to=u.id or fd.resolved_by=u.id)
  and not exists (select 1 from public.refunds rf where rf.requested_by=u.id or rf.processed_by=u.id)
  and not exists (select 1 from public.withdrawals wd where wd.requested_by=u.id or wd.processed_by=u.id)
  and not exists (select 1 from public.payouts po where po.processed_by=u.id)
  and not exists (select 1 from public.cash_collections cash where cash.reconciled_by=u.id)
  and not exists (select 1 from public.platform_events pe where pe.actor_user_id=u.id or pe.target_user_id=u.id)
  and not exists (select 1 from public.order_status_history osh where osh.actor_user_id=u.id)
  and not exists (select 1 from public.notifications n where n.recipient_user_id=u.id)
  and not exists (select 1 from public.support_tickets st where st.requester_user_id=u.id or st.assignee_user_id=u.id)
  and not exists (select 1 from public.support_messages sm where sm.sender_user_id=u.id)
  and not exists (select 1 from public.umrah_bookings ub where ub.customer_user_id=u.id)
  and not exists (select 1 from public.umrah_packages up where up.created_by=u.id);

delete from public.captain_profiles where user_id in (select id from auth_cleanup_targets);
delete from public.notification_preferences where user_id in (select id from auth_cleanup_targets);
delete from public.wallets where owner_user_id in (select id from auth_cleanup_targets);
delete from public.user_roles where user_id in (select id from auth_cleanup_targets);
delete from public.profiles where id in (select id from auth_cleanup_targets);
delete from auth.users where id in (select id from auth_cleanup_targets);

drop function if exists public.create_whatsapp_challenge(text, uuid, text, text);
drop function if exists public.verify_whatsapp_challenge(uuid, text, text);
drop table if exists private.whatsapp_auth_challenges;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  display_name text;
  requested_language text;
begin
  display_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '');
  requested_language := lower(trim(coalesce(new.raw_user_meta_data->>'preferred_language', 'ckb')));
  insert into public.profiles (id, full_name, phone, preferred_language, city)
  values (
    new.id,
    display_name,
    nullif(trim(coalesce(new.phone, new.raw_user_meta_data->>'phone', '')), ''),
    case when requested_language in ('ckb','ar','en') then requested_language else 'ckb' end,
    coalesce(nullif(trim(new.raw_user_meta_data->>'city'), ''), 'هەولێر')
  )
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role_code)
  values (new.id, 'customer')
  on conflict (user_id, role_code) do nothing;
  return new;
end;
$function$;

create or replace function private.handle_new_user_finance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  insert into public.wallets(wallet_type, owner_user_id)
  values ('customer', new.id)
  on conflict do nothing;
  return new;
end;
$function$;

create or replace function private.handle_new_user_role_wallet()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.role_code = 'captain' then
    insert into public.wallets(wallet_type, owner_user_id)
    values ('captain', new.user_id)
    on conflict do nothing;
  end if;
  return new;
end;
$function$;

create or replace function private.bootstrap_captain_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if new.role_code = 'captain' then
    insert into public.captain_profiles(user_id, captain_code)
    values (
      new.user_id,
      'SKC-' || upper(replace(substr(new.user_id::text, 1, 8), '-', ''))
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.handle_new_user();

drop trigger if exists on_profile_wallet_created on public.profiles;
create trigger on_profile_wallet_created after insert on public.profiles
for each row execute function private.handle_new_user_finance();

drop trigger if exists on_captain_role_profile_created on public.user_roles;
create trigger on_captain_role_profile_created after insert on public.user_roles
for each row execute function private.bootstrap_captain_profile();

drop trigger if exists on_user_role_wallet_created on public.user_roles;
create trigger on_user_role_wallet_created after insert on public.user_roles
for each row execute function private.handle_new_user_role_wallet();
