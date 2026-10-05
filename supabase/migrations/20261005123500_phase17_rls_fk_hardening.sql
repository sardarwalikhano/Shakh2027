-- SHAKH 2027 Phase 17F — RLS lint + FK index hardening

drop policy if exists deny_direct_promotions_access on public.promotions;
create policy deny_direct_promotions_access on public.promotions
for all to anon,authenticated using (false) with check (false);

drop policy if exists deny_direct_coupon_codes_access on public.coupon_codes;
create policy deny_direct_coupon_codes_access on public.coupon_codes
for all to anon,authenticated using (false) with check (false);

drop policy if exists deny_direct_coupon_redemptions_access on public.coupon_redemptions;
create policy deny_direct_coupon_redemptions_access on public.coupon_redemptions
for all to anon,authenticated using (false) with check (false);

drop policy if exists deny_direct_analytics_events_access on public.analytics_events;
create policy deny_direct_analytics_events_access on public.analytics_events
for all to anon,authenticated using (false) with check (false);

create index if not exists idx_checkout_sessions_coupon_id on public.checkout_sessions(coupon_id);
create index if not exists idx_coupon_codes_created_by on public.coupon_codes(created_by);
create index if not exists idx_coupon_redemptions_coupon_id on public.coupon_redemptions(coupon_id);
create index if not exists idx_orders_coupon_id on public.orders(coupon_id);
create index if not exists idx_promotions_created_by on public.promotions(created_by);
