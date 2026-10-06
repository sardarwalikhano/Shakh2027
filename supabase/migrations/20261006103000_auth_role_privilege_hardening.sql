-- SHAKH 2027: authentication/RBAC privilege hardening
-- Applied to the connected Supabase project before this file was committed.

create or replace function private.can_manage_user_role(
  p_target_user_id uuid,
  p_target_role text,
  p_action text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v_super_admin_count integer;
begin
  if auth.uid() is null
     or p_target_user_id is null
     or nullif(trim(p_target_role), '') is null
     or p_action not in ('insert','delete') then
    return false;
  end if;

  if not private.has_permission('roles.manage') then
    return false;
  end if;

  if p_target_role in ('admin','super_admin')
     and not private.has_permission('platform.manage') then
    return false;
  end if;

  if p_action = 'delete' and p_target_role = 'super_admin' then
    select count(*)::integer into v_super_admin_count
    from public.user_roles
    where role_code = 'super_admin';

    if v_super_admin_count <= 1 then
      return false;
    end if;
  end if;

  return true;
end;
$function$;

drop policy if exists "authorized users can manage roles" on public.user_roles;
create policy "authorized users can manage roles"
on public.user_roles
for insert
to authenticated
with check (
  (select private.can_manage_user_role(user_id, role_code, 'insert'))
);

drop policy if exists "authorized users can delete roles" on public.user_roles;
create policy "authorized users can delete roles"
on public.user_roles
for delete
to authenticated
using (
  (select private.can_manage_user_role(user_id, role_code, 'delete'))
);

create or replace function private.create_role_application(
  p_requested_role text,
  p_note text default null
)
returns public.role_applications
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v public.role_applications%rowtype;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated' using errcode='P0001';
  end if;

  if p_requested_role not in (
    'captain','captain_manager',
    'restaurant_vendor','supermarket_vendor','fashion_vendor',
    'car_dealer','umrah_agency','beauty_vendor','support'
  ) then
    raise exception 'role_application_not_allowed' using errcode='P0001';
  end if;

  v_note := nullif(trim(p_note), '');
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'role_application_note_too_long' using errcode='P0001';
  end if;

  if exists (
    select 1 from public.user_roles
    where user_id=auth.uid() and role_code=p_requested_role
  ) then
    raise exception 'role_already_assigned' using errcode='P0001';
  end if;

  select * into v
  from public.role_applications
  where applicant_user_id=auth.uid()
    and requested_role=p_requested_role
  for update;

  if found and v.status='requested' then return v; end if;
  if found and v.status='approved' then raise exception 'role_already_approved' using errcode='P0001'; end if;

  insert into public.role_applications(applicant_user_id,requested_role,status,note)
  values(auth.uid(),p_requested_role,'requested',v_note)
  on conflict(applicant_user_id,requested_role)
  do update set
    status='requested',
    note=excluded.note,
    reviewed_by=null,
    review_note=null,
    reviewed_at=null,
    updated_at=now()
  returning * into v;

  return v;
end;
$function$;

create or replace function private.review_role_application(
  p_application_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.role_applications
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  v public.role_applications%rowtype;
  v_review_note text;
begin
  if not private.has_permission('roles.manage') then
    raise exception 'roles_permission_required' using errcode='P0001';
  end if;

  if p_status not in('approved','rejected','cancelled') then
    raise exception 'invalid_application_review_status' using errcode='P0001';
  end if;

  select * into v
  from public.role_applications
  where id=p_application_id
  for update;

  if not found then
    raise exception 'role_application_not_found' using errcode='P0001';
  end if;

  if v.status<>'requested' then
    return v;
  end if;

  if v.requested_role in ('admin','super_admin')
     and not private.has_permission('platform.manage') then
    raise exception 'platform_permission_required_for_privileged_role' using errcode='P0001';
  end if;

  v_review_note := nullif(trim(p_review_note), '');
  if v_review_note is not null and length(v_review_note) > 2000 then
    raise exception 'role_review_note_too_long' using errcode='P0001';
  end if;

  update public.role_applications
  set
    status=p_status,
    reviewed_by=auth.uid(),
    review_note=v_review_note,
    reviewed_at=now(),
    updated_at=now()
  where id=v.id
  returning * into v;

  if p_status='approved' then
    insert into public.user_roles(user_id,role_code,assigned_by)
    values(v.applicant_user_id,v.requested_role,auth.uid())
    on conflict(user_id,role_code) do nothing;

    if v.requested_role='umrah_agency'
       and not exists(
         select 1 from public.vendors
         where owner_user_id=v.applicant_user_id and vendor_type='umrah'
       ) then
      insert into public.vendors(
        owner_user_id,vendor_type,slug,name_ckb,name_ar,name_en,status
      )
      select
        p.id,
        'umrah',
        'umrah-'||p.id::text,
        coalesce(p.full_name,'عومرە'),
        'عمرة',
        coalesce(p.full_name,'Umrah Agency'),
        'pending'
      from public.profiles p
      where p.id=v.applicant_user_id
      on conflict(slug) do nothing;
    end if;
  end if;

  insert into public.audit_logs(
    actor_user_id,action,entity_type,entity_id,metadata
  )
  values(
    auth.uid(),
    'role_application_reviewed',
    'role_application',
    v.id,
    jsonb_build_object(
      'requested_role',v.requested_role,
      'status',v.status,
      'applicant_user_id',v.applicant_user_id
    )
  );

  return v;
end;
$function$;

create or replace function public.create_role_application(
  p_requested_role text,
  p_note text default null
)
returns public.role_applications
language sql
security invoker
set search_path = pg_catalog, public, private
as $function$
  select private.create_role_application(p_requested_role,p_note);
$function$;

create or replace function public.list_role_applications(
  p_status text default null
)
returns setof public.role_applications
language sql
security invoker
set search_path = pg_catalog, public, private
as $function$
  select *
  from public.role_applications
  where (p_status is null or status=p_status)
    and (
      applicant_user_id=(select auth.uid())
      or (select private.has_permission('role_applications.read'))
      or (select private.has_permission('roles.manage'))
    )
  order by created_at desc
  limit 200;
$function$;

create or replace function public.review_role_application(
  p_application_id uuid,
  p_status text,
  p_review_note text default null
)
returns public.role_applications
language sql
security invoker
set search_path = pg_catalog, public, private
as $function$
  select private.review_role_application(
    p_application_id,
    p_status,
    p_review_note
  );
$function$;

revoke execute on function public.create_role_application(text,text) from public;
revoke execute on function public.list_role_applications(text) from public;
revoke execute on function public.review_role_application(uuid,text,text) from public;

grant execute on function public.create_role_application(text,text) to authenticated, service_role;
grant execute on function public.list_role_applications(text) to authenticated, service_role;
grant execute on function public.review_role_application(uuid,text,text) to authenticated, service_role;
