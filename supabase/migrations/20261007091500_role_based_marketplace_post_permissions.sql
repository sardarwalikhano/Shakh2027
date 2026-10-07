-- Role-based marketplace post authorization.
-- The same rules are already applied to the production database.

insert into public.permissions (code,name_ckb,name_ar,name_en,description)
values (
  'posts.create',
  'درووستکردنی پۆست',
  'إنشاء المنشورات',
  'Create Posts',
  'Create marketplace posts only in sections allowed for the authenticated role'
)
on conflict (code) do update
set name_ckb=excluded.name_ckb,name_ar=excluded.name_ar,name_en=excluded.name_en,description=excluded.description;

insert into public.role_permissions(role_code,permission_code)
select role_code,'posts.create'
from (values
  ('super_admin'),('customer'),('car_dealer'),('restaurant_vendor'),
  ('supermarket_vendor'),('fashion_vendor'),('beauty_vendor'),
  ('umrah_agency'),('captain'),('captain_manager')
) v(role_code)
on conflict (role_code,permission_code) do nothing;

create or replace function private.allowed_marketplace_post_section(p_section_code text)
returns boolean language sql stable security definer
set search_path to 'pg_catalog','public','private'
as $function$
select private.has_role('super_admin')
or exists (
  select 1 from public.user_roles ur
  where ur.user_id=auth.uid()
    and (
      (p_section_code='cars' and ur.role_code in (
        'customer','car_dealer','restaurant_vendor','supermarket_vendor',
        'fashion_vendor','beauty_vendor','umrah_agency','captain','captain_manager'
      ))
      or (p_section_code='food' and ur.role_code='restaurant_vendor')
      or (p_section_code='supermarket' and ur.role_code='supermarket_vendor')
      or (p_section_code='fashion' and ur.role_code='fashion_vendor')
      or (p_section_code='beauty' and ur.role_code='beauty_vendor')
      or (p_section_code='umrah' and ur.role_code='umrah_agency')
      or (p_section_code='delivery' and ur.role_code in ('captain','captain_manager'))
    )
  );
$function$;

-- The private create functions enforce the same section rule and posts.create permission.
-- Public wrappers remain available only to authenticated callers.
revoke execute on function public.create_targeted_marketplace_post(
  text,text,uuid,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) from public,anon;
grant execute on function public.create_targeted_marketplace_post(
  text,text,uuid,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) to authenticated;

revoke execute on function public.create_marketplace_post(
  text,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) from public,anon;
grant execute on function public.create_marketplace_post(
  text,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) to authenticated;
