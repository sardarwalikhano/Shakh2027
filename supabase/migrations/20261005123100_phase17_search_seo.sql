-- SHAKH 2027 — Phase 17
-- Search + SEO + Promotions/Coupons + Analytics
-- No existing business functionality is removed. Existing 3-argument checkout
-- RPCs remain compatible and delegate to the new 4-argument implementations.

create extension if not exists pgroonga with schema extensions;

-- ---------------------------------------------------------------------------
-- Multilingual search + SEO metadata
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists search_text text generated always as (
    coalesce(slug,'') || ' ' || coalesce(name_ckb,'') || ' ' || coalesce(name_ar,'') || ' ' ||
    coalesce(name_en,'') || ' ' || coalesce(description_ckb,'') || ' ' ||
    coalesce(description_ar,'') || ' ' || coalesce(description_en,'')
  ) stored,
  add column if not exists seo_title_ckb text,
  add column if not exists seo_title_ar text,
  add column if not exists seo_title_en text,
  add column if not exists seo_description_ckb text,
  add column if not exists seo_description_ar text,
  add column if not exists seo_description_en text;

alter table public.vendors
  add column if not exists search_text text generated always as (
    coalesce(slug,'') || ' ' || coalesce(name_ckb,'') || ' ' || coalesce(name_ar,'') || ' ' ||
    coalesce(name_en,'') || ' ' || coalesce(description,'')
  ) stored,
  add column if not exists seo_title_ckb text,
  add column if not exists seo_title_ar text,
  add column if not exists seo_title_en text,
  add column if not exists seo_description_ckb text,
  add column if not exists seo_description_ar text,
  add column if not exists seo_description_en text;

alter table public.categories
  add column if not exists search_text text generated always as (
    coalesce(slug,'') || ' ' || coalesce(name_ckb,'') || ' ' || coalesce(name_ar,'') || ' ' || coalesce(name_en,'')
  ) stored,
  add column if not exists seo_title_ckb text,
  add column if not exists seo_title_ar text,
  add column if not exists seo_title_en text,
  add column if not exists seo_description_ckb text,
  add column if not exists seo_description_ar text,
  add column if not exists seo_description_en text;

create index if not exists idx_products_search_text_pgroonga on public.products using pgroonga(search_text);
create index if not exists idx_vendors_search_text_pgroonga on public.vendors using pgroonga(search_text);
create index if not exists idx_categories_search_text_pgroonga on public.categories using pgroonga(search_text);


create or replace function public.global_search(
  p_query text,
  p_category_id uuid default null,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_only_available boolean default true,
  p_limit integer default 30
)
returns jsonb
language plpgsql
security invoker
set search_path=pg_catalog,public,private,extensions
as $$
declare
  v_query text:=trim(coalesce(p_query,''));
  v_limit integer:=greatest(1,least(coalesce(p_limit,30),60));
  v_products jsonb;
  v_vendors jsonb;
  v_categories jsonb;
begin
  if length(v_query)=0 then
    return jsonb_build_object('query','','products','[]'::jsonb,'vendors','[]'::jsonb,'categories','[]'::jsonb);
  end if;
  if length(v_query)>120 then raise exception 'search_query_too_long' using errcode='P0001'; end if;

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_products
  from (
    select p.id,p.slug,p.name_ckb,p.name_ar,p.name_en,p.description_ckb,p.description_ar,p.description_en,
           p.base_price_iqd,p.compare_at_iqd,p.rating,p.review_count,p.is_in_stock,p.vendor_id,p.category_id,
           v.name_ckb as vendor_name_ckb,v.name_ar as vendor_name_ar,v.name_en as vendor_name_en,
           c.name_ckb as category_name_ckb,c.name_ar as category_name_ar,c.name_en as category_name_en,
           (select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.sort_order,pi.created_at limit 1) as image_storage_path,
           p.created_at
    from public.products p
    join public.vendors v on v.id=p.vendor_id and v.status='active'
    left join public.categories c on c.id=p.category_id and c.is_active=true
    where p.status='active'
      and (p_category_id is null or p.category_id=p_category_id)
      and (p_min_price is null or p.base_price_iqd>=p_min_price)
      and (p_max_price is null or p.base_price_iqd<=p_max_price)
      and (not coalesce(p_only_available,true) or p.is_in_stock=true)
      and (p.search_text &@~ v_query or v.search_text &@~ v_query or coalesce(c.search_text,'') &@~ v_query)
    order by p.is_featured desc,p.created_at desc
    limit v_limit
  ) x;

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_vendors
  from (
    select v.id,v.slug,v.name_ckb,v.name_ar,v.name_en,v.description,v.logo_url,v.vendor_type,v.created_at
    from public.vendors v
    where v.status='active' and v.search_text &@~ v_query
    order by v.created_at desc limit 12
  ) x;

  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_categories
  from (
    select c.id,c.slug,c.name_ckb,c.name_ar,c.name_en,c.icon_key,c.sort_order
    from public.categories c
    where c.is_active=true and c.search_text &@~ v_query
    order by c.sort_order,c.name_ckb limit 12
  ) x;

  return jsonb_build_object('query',v_query,'products',v_products,'vendors',v_vendors,'categories',v_categories);
end;
$$;
revoke all on function public.global_search(text,uuid,numeric,numeric,boolean,integer) from public;
grant execute on function public.global_search(text,uuid,numeric,numeric,boolean,integer) to anon,authenticated;
