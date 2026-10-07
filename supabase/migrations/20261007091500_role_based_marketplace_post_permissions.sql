-- Role-based marketplace post authorization.
-- This migration is idempotent and records the production authorization rules.
CREATE OR REPLACE FUNCTION private.allowed_marketplace_post_section(p_section_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  select
    private.has_role('super_admin')
    or exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and (
          (p_section_code = 'cars' and ur.role_code in (
            'customer',
            'car_dealer',
            'restaurant_vendor',
            'supermarket_vendor',
            'fashion_vendor',
            'beauty_vendor',
            'umrah_agency',
            'captain',
            'captain_manager'
          ))
          or (p_section_code = 'food' and ur.role_code = 'restaurant_vendor')
          or (p_section_code = 'supermarket' and ur.role_code = 'supermarket_vendor')
          or (p_section_code = 'fashion' and ur.role_code = 'fashion_vendor')
          or (p_section_code = 'beauty' and ur.role_code = 'beauty_vendor')
          or (p_section_code = 'umrah' and ur.role_code = 'umrah_agency')
          or (p_section_code = 'delivery' and ur.role_code in ('captain','captain_manager'))
        )
    );
$function$


CREATE OR REPLACE FUNCTION private.create_marketplace_post(p_section_code text, p_title_ckb text, p_title_ar text, p_title_en text, p_content_ckb text DEFAULT NULL::text, p_content_ar text DEFAULT NULL::text, p_content_en text DEFAULT NULL::text, p_image_urls jsonb DEFAULT '[]'::jsonb, p_price_iqd numeric DEFAULT NULL::numeric, p_cta_label_ckb text DEFAULT NULL::text, p_cta_label_ar text DEFAULT NULL::text, p_cta_label_en text DEFAULT NULL::text, p_status text DEFAULT 'published'::text, p_is_featured boolean DEFAULT false, p_idempotency_key text DEFAULT NULL::text)
 RETURNS marketplace_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user uuid := auth.uid();
  v_existing public.marketplace_posts%rowtype;
  v_row public.marketplace_posts%rowtype;
  v_route text;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode='P0001';
  end if;

  if not private.has_permission('posts.create') then
    raise exception 'posts_permission_required' using errcode='P0001';
  end if;

  if p_section_code not in (
    'marketplace','food','supermarket','fashion','beauty',
    'cars','umrah','delivery','offers','announcement'
  ) then
    raise exception 'invalid_marketplace_post_section' using errcode='P0001';
  end if;

  if not private.allowed_marketplace_post_section(p_section_code) then
    raise exception 'marketplace_post_section_forbidden' using errcode='P0001';
  end if;

  if length(trim(coalesce(p_title_ckb,'')))<2
     or length(trim(coalesce(p_title_ar,'')))<2
     or length(trim(coalesce(p_title_en,'')))<2 then
    raise exception 'marketplace_post_titles_required' using errcode='P0001';
  end if;

  if p_status not in ('draft','published','archived') then
    raise exception 'invalid_marketplace_post_status' using errcode='P0001';
  end if;

  if p_image_urls is null
     or jsonb_typeof(p_image_urls)<>'array'
     or jsonb_array_length(p_image_urls)>8 then
    raise exception 'invalid_marketplace_post_images' using errcode='P0001';
  end if;

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) not between 16 and 128 then
    raise exception 'invalid_idempotency_key' using errcode='P0001';
  end if;

  select * into v_existing
  from public.marketplace_posts
  where created_by=v_user
    and idempotency_key=trim(p_idempotency_key)
  for update;

  if found then return v_existing; end if;

  v_route := case p_section_code
    when 'cars' then '#cars'
    when 'umrah' then '#umrah'
    when 'delivery' then '#delivery'
    else '#market'
  end;

  insert into public.marketplace_posts(
    created_by,section_code,title_ckb,title_ar,title_en,
    content_ckb,content_ar,content_en,image_urls,price_iqd,
    cta_label_ckb,cta_label_ar,cta_label_en,target_route,
    status,is_featured,idempotency_key,published_at
  ) values (
    v_user,p_section_code,trim(p_title_ckb),trim(p_title_ar),trim(p_title_en),
    nullif(trim(coalesce(p_content_ckb,'')),''),nullif(trim(coalesce(p_content_ar,'')),''),
    nullif(trim(coalesce(p_content_en,'')),''),
    coalesce(p_image_urls,'[]'::jsonb),p_price_iqd,
    nullif(trim(coalesce(p_cta_label_ckb,'')),''),
    nullif(trim(coalesce(p_cta_label_ar,'')),''),
    nullif(trim(coalesce(p_cta_label_en,'')),''),
    v_route,p_status,coalesce(p_is_featured,false),trim(p_idempotency_key),
    case when p_status='published' then now() else null end
  )
  returning * into v_row;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values (
    v_user,'marketplace_post_created','marketplace_post',v_row.id,
    jsonb_build_object(
      'section_code',v_row.section_code,
      'status',v_row.status,
      'is_featured',v_row.is_featured
    )
  );

  return v_row;
end;
$function$


CREATE OR REPLACE FUNCTION private.create_targeted_marketplace_post(p_section_code text, p_target_role text DEFAULT NULL::text, p_category_id uuid DEFAULT NULL::uuid, p_title_ckb text DEFAULT ''::text, p_title_ar text DEFAULT ''::text, p_title_en text DEFAULT ''::text, p_content_ckb text DEFAULT NULL::text, p_content_ar text DEFAULT NULL::text, p_content_en text DEFAULT NULL::text, p_image_urls jsonb DEFAULT '[]'::jsonb, p_price_iqd numeric DEFAULT NULL::numeric, p_cta_label_ckb text DEFAULT NULL::text, p_cta_label_ar text DEFAULT NULL::text, p_cta_label_en text DEFAULT NULL::text, p_status text DEFAULT 'published'::text, p_is_featured boolean DEFAULT false, p_idempotency_key text DEFAULT NULL::text)
 RETURNS marketplace_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_user uuid := auth.uid();
  v_existing public.marketplace_posts%rowtype;
  v_row public.marketplace_posts%rowtype;
  v_route text;
  v_role_exists boolean;
  v_category_exists boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode='P0001';
  end if;

  if not private.has_permission('posts.create') then
    raise exception 'posts_permission_required' using errcode='P0001';
  end if;

  if p_section_code not in (
    'marketplace','food','supermarket','fashion','beauty',
    'cars','umrah','delivery','offers','announcement'
  ) then
    raise exception 'invalid_marketplace_post_section' using errcode='P0001';
  end if;

  if not private.allowed_marketplace_post_section(p_section_code) then
    raise exception 'marketplace_post_section_forbidden' using errcode='P0001';
  end if;

  if length(trim(coalesce(p_title_ckb,''))) < 2
     or length(trim(coalesce(p_title_ar,''))) < 2
     or length(trim(coalesce(p_title_en,''))) < 2 then
    raise exception 'marketplace_post_titles_required' using errcode='P0001';
  end if;

  if p_target_role is not null then
    select exists(
      select 1 from public.app_roles where code = trim(p_target_role)
    ) into v_role_exists;

    if not coalesce(v_role_exists,false) then
      raise exception 'invalid_target_role' using errcode='P0001';
    end if;

    if not private.has_role('super_admin')
       and not private.has_role(trim(p_target_role)) then
      raise exception 'target_role_forbidden' using errcode='P0001';
    end if;
  end if;

  if p_category_id is not null then
    select exists(
      select 1 from public.categories
      where id = p_category_id and is_active = true
    ) into v_category_exists;

    if not coalesce(v_category_exists,false) then
      raise exception 'invalid_category' using errcode='P0001';
    end if;
  end if;

  if p_status not in ('draft','published','archived') then
    raise exception 'invalid_marketplace_post_status' using errcode='P0001';
  end if;

  if p_image_urls is null
     or jsonb_typeof(p_image_urls) <> 'array'
     or jsonb_array_length(p_image_urls) > 8 then
    raise exception 'invalid_marketplace_post_images' using errcode='P0001';
  end if;

  if exists (
    select 1
    from jsonb_array_elements_text(coalesce(p_image_urls,'[]'::jsonb)) as image_url(value)
    where length(trim(value)) < 8
       or value !~* '^https?://'
  ) then
    raise exception 'invalid_marketplace_post_image_url' using errcode='P0001';
  end if;

  if p_idempotency_key is null
     or length(trim(p_idempotency_key)) not between 16 and 128 then
    raise exception 'invalid_idempotency_key' using errcode='P0001';
  end if;

  select * into v_existing
  from public.marketplace_posts
  where created_by = v_user
    and idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    return v_existing;
  end if;

  v_route := case p_section_code
    when 'cars' then '#cars'
    when 'umrah' then '#umrah'
    when 'delivery' then '#delivery'
    else '#market'
  end;

  insert into public.marketplace_posts(
    created_by, section_code, target_role, category_id,
    title_ckb, title_ar, title_en,
    content_ckb, content_ar, content_en,
    image_urls, price_iqd,
    cta_label_ckb, cta_label_ar, cta_label_en,
    target_route, status, is_featured, idempotency_key, published_at
  ) values (
    v_user, p_section_code, nullif(trim(p_target_role),''), p_category_id,
    trim(p_title_ckb), trim(p_title_ar), trim(p_title_en),
    nullif(trim(coalesce(p_content_ckb,'')),''),
    nullif(trim(coalesce(p_content_ar,'')),''),
    nullif(trim(coalesce(p_content_en,'')),''),
    coalesce(p_image_urls,'[]'::jsonb), p_price_iqd,
    nullif(trim(coalesce(p_cta_label_ckb,'')),''),
    nullif(trim(coalesce(p_cta_label_ar,'')),''),
    nullif(trim(coalesce(p_cta_label_en,'')),''),
    v_route, p_status, coalesce(p_is_featured,false),
    trim(p_idempotency_key),
    case when p_status = 'published' then now() else null end
  )
  returning * into v_row;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values (
    v_user,
    'marketplace_targeted_post_created',
    'marketplace_post',
    v_row.id,
    jsonb_build_object(
      'section_code', v_row.section_code,
      'target_role', v_row.target_role,
      'category_id', v_row.category_id,
      'status', v_row.status,
      'is_featured', v_row.is_featured
    )
  );

  return v_row;
end;
$function$



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

