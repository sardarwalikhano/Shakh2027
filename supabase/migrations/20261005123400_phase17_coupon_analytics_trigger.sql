-- SHAKH 2027 Phase 17E — Coupon redemption analytics
create or replace function private.record_coupon_redemption_analytics()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  perform private.record_analytics_event(
    'coupon_redeemed',
    'promotion',
    new.promotion_id,
    null,
    jsonb_build_object('discount_iqd',new.discount_iqd,'coupon_id',new.coupon_id),
    null
  );
  return new;
end;
$$;
revoke all on function private.record_coupon_redemption_analytics() from public,anon,authenticated;
grant execute on function private.record_coupon_redemption_analytics() to authenticated;
drop trigger if exists coupon_redemptions_analytics on public.coupon_redemptions;
create trigger coupon_redemptions_analytics
after insert on public.coupon_redemptions
for each row execute function private.record_coupon_redemption_analytics();
