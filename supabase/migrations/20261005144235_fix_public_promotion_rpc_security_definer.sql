-- Keep private implementation routines inaccessible to API roles.
-- Public RPC wrappers are SECURITY DEFINER so they can safely delegate
-- to the private schema without granting schema usage to anon/authenticated.
-- Authorization remains enforced by the private routines themselves.

alter function public.list_active_promotions()
  security definer
  set search_path = pg_catalog;

alter function public.list_promotions_admin(integer)
  security definer
  set search_path = pg_catalog;

alter function public.validate_coupon(text)
  security definer
  set search_path = pg_catalog;

alter function public.create_promotion(jsonb)
  security definer
  set search_path = pg_catalog;

alter function public.create_coupon_code(uuid, text, bigint, integer)
  security definer
  set search_path = pg_catalog;

alter function public.set_promotion_active(uuid, boolean)
  security definer
  set search_path = pg_catalog;

alter function public.set_coupon_active(uuid, boolean)
  security definer
  set search_path = pg_catalog;
