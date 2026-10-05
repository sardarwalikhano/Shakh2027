-- Keep the private role-application implementation inaccessible to API roles.
-- Public wrappers use SECURITY DEFINER so they can safely call private routines
-- and private.has_permission() without exposing the private schema.
-- The underlying permission checks remain authoritative.

alter function public.list_role_applications(text)
  security definer
  set search_path = pg_catalog;

alter function public.create_role_application(text, text)
  security definer
  set search_path = pg_catalog;

alter function public.review_role_application(uuid, text, text)
  security definer
  set search_path = pg_catalog;
