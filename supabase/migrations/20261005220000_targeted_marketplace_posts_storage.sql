-- SHAKH marketplace posts: targeted audience + category + image access hardening
-- Live schema was validated/applied before committing this migration snapshot.

alter table public.marketplace_posts
  add column if not exists target_role text,
  add column if not exists category_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_posts_target_role_fkey'
      and conrelid = 'public.marketplace_posts'::regclass
  ) then
    alter table public.marketplace_posts
      add constraint marketplace_posts_target_role_fkey
      foreign key (target_role) references public.app_roles(code)
      on update cascade on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'marketplace_posts_category_id_fkey'
      and conrelid = 'public.marketplace_posts'::regclass
  ) then
    alter table public.marketplace_posts
      add constraint marketplace_posts_category_id_fkey
      foreign key (category_id) references public.categories(id)
      on update cascade on delete set null;
  end if;
end $$;

create index if not exists marketplace_posts_feed_idx
  on public.marketplace_posts (status, target_role, category_id, published_at desc, created_at desc);

create or replace function private.create_targeted_marketplace_post(
  p_section_code text,
  p_target_role text default null,
  p_category_id uuid default null,
  p_title_ckb text default '',
  p_title_ar text default '',
  p_title_en text default '',
  p_content_ckb text default null,
  p_content_ar text default null,
  p_content_en text default null,
  p_image_urls jsonb default '[]'::jsonb,
  p_price_iqd numeric default null,
  p_cta_label_ckb text default null,
  p_cta_label_ar text default null,
  p_cta_label_en text default null,
  p_status text default 'published',
  p_is_featured boolean default false,
  p_idempotency_key text default null
)
returns public.marketplace_posts
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
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

  if not private.has_permission('platform.manage') then
    raise exception 'platform_permission_required' using errcode='P0001';
  end if;

  if p_section_code not in ('marketplace','food','supermarket','fashion','beauty','cars','umrah','delivery','offers','announcement') then
    raise exception 'invalid_marketplace_post_section' using errcode='P0001';
  end if;

  if length(trim(coalesce(p_title_ckb,''))) < 2
     or length(trim(coalesce(p_title_ar,''))) < 2
     or length(trim(coalesce(p_title_en,''))) < 2 then
    raise exception 'marketplace_post_titles_required' using errcode='P0001';
  end if;

  if p_target_role is not null then
    select exists(select 1 from public.app_roles where code = trim(p_target_role))
      into v_role_exists;
    if not coalesce(v_role_exists,false) then
      raise exception 'invalid_target_role' using errcode='P0001';
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

  if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 16 and 128 then
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
$function$;

create or replace function public.create_targeted_marketplace_post(
  p_section_code text,
  p_target_role text default null,
  p_category_id uuid default null,
  p_title_ckb text default '',
  p_title_ar text default '',
  p_title_en text default '',
  p_content_ckb text default null,
  p_content_ar text default null,
  p_content_en text default null,
  p_image_urls jsonb default '[]'::jsonb,
  p_price_iqd numeric default null,
  p_cta_label_ckb text default null,
  p_cta_label_ar text default null,
  p_cta_label_en text default null,
  p_status text default 'published',
  p_is_featured boolean default false,
  p_idempotency_key text default null
)
returns public.marketplace_posts
language sql
security definer
set search_path = pg_catalog, public, private
as $function$
  select private.create_targeted_marketplace_post(
    p_section_code,
    p_target_role,
    p_category_id,
    p_title_ckb,
    p_title_ar,
    p_title_en,
    p_content_ckb,
    p_content_ar,
    p_content_en,
    p_image_urls,
    p_price_iqd,
    p_cta_label_ckb,
    p_cta_label_ar,
    p_cta_label_en,
    p_status,
    p_is_featured,
    p_idempotency_key
  );
$function$;

revoke all on function public.create_targeted_marketplace_post(
  text,text,uuid,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) from public, anon, authenticated;

grant execute on function public.create_targeted_marketplace_post(
  text,text,uuid,text,text,text,text,text,text,jsonb,numeric,text,text,text,text,boolean,text
) to authenticated;

create or replace function public.list_targeted_marketplace_posts(
  p_section_code text default null,
  p_target_role text default null,
  p_category_id uuid default null,
  p_limit integer default 24
)
returns setof public.marketplace_posts
language sql
security invoker
set search_path = pg_catalog, public, private
as $function$
  select p.*
  from public.marketplace_posts p
  where p.status = 'published'
    and (p_section_code is null or p.section_code = p_section_code)
    and (p_target_role is null or p.target_role is null or p.target_role = p_target_role)
    and (p_category_id is null or p.category_id is null or p.category_id = p_category_id)
  order by p.is_featured desc, coalesce(p.published_at,p.created_at) desc
  limit greatest(1,least(coalesce(p_limit,24),100));
$function$;

revoke all on function public.list_targeted_marketplace_posts(text,text,uuid,integer) from public;
grant execute on function public.list_targeted_marketplace_posts(text,text,uuid,integer) to anon, authenticated;

drop policy if exists "marketplace post image upload" on storage.objects;
create policy "marketplace post image upload"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'marketplace-posts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select private.has_permission('platform.manage'))
);

drop policy if exists "marketplace post image delete" on storage.objects;
create policy "marketplace post image delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'marketplace-posts'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and (select private.has_permission('platform.manage'))
);
