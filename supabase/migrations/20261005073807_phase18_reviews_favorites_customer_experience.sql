-- SHAKH 2027 — Phase 18
-- Reviews/Ratings + Favorites/Wishlist + verified-purchase customer experience.
-- Applied to the new SHAKH Supabase project as migration 20261005073807.

create table if not exists public.favorite_products (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete cascade,
  reviewer_display_name text not null default 'کڕیار',
  rating integer not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'published' check (status in ('published','hidden','rejected')),
  verified_purchase boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reviewer_user_id, product_id)
);

create index if not exists idx_favorite_products_product_id on public.favorite_products(product_id);
create index if not exists idx_favorite_products_user_created on public.favorite_products(user_id,created_at desc);
create index if not exists idx_product_reviews_product_status_created on public.product_reviews(product_id,status,created_at desc);
create index if not exists idx_product_reviews_order_id on public.product_reviews(order_id);
create index if not exists idx_product_reviews_reviewer_user_id on public.product_reviews(reviewer_user_id);

alter table public.favorite_products enable row level security;
alter table public.product_reviews enable row level security;
revoke all on table public.favorite_products from anon,authenticated;
revoke all on table public.product_reviews from anon,authenticated;

create policy favorite_products_select_own on public.favorite_products
for select to authenticated using (user_id=(select auth.uid()));
create policy favorite_products_insert_own on public.favorite_products
for insert to authenticated with check (user_id=(select auth.uid()));
create policy favorite_products_delete_own on public.favorite_products
for delete to authenticated using (user_id=(select auth.uid()));
create policy product_reviews_read_published on public.product_reviews
for select to anon,authenticated using (status='published' or reviewer_user_id=(select auth.uid()));

insert into public.permissions(code,name_ckb,name_ar,name_en,description)
values
 ('reviews.read','خوێندنەوەی هەڵسەنگاندن','قراءة التقييمات','Read reviews','View review and rating analytics'),
 ('reviews.manage','بەڕێوەبردنی هەڵسەنگاندن','إدارة التقييمات','Manage reviews','Moderate product reviews')
on conflict (code) do nothing;

insert into public.role_permissions(role_code,permission_code)
select r.code,p.code from public.app_roles r cross join public.permissions p
where r.code in ('super_admin','admin','support') and p.code in ('reviews.read','reviews.manage')
on conflict (role_code,permission_code) do nothing;

create or replace function private.set_updated_at_phase18()
returns trigger language plpgsql set search_path=pg_catalog,public,private as $$
begin new.updated_at=now(); return new; end;
$$;

create or replace function private.refresh_product_rating(p_product_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_count integer; v_rating numeric(4,2);
begin
  if p_product_id is null then return; end if;
  select count(*)::integer, round(avg(rating)::numeric,2) into v_count,v_rating
  from public.product_reviews where product_id=p_product_id and status='published';
  update public.products set review_count=v_count,rating=case when v_count=0 then null else v_rating end,updated_at=now()
  where id=p_product_id;
end;
$$;

create or replace function private.product_review_rating_sync()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if tg_op in ('UPDATE','DELETE') then perform private.refresh_product_rating(old.product_id); end if;
  if tg_op in ('INSERT','UPDATE') then perform private.refresh_product_rating(new.product_id); end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists product_reviews_set_updated_at on public.product_reviews;
create trigger product_reviews_set_updated_at before update on public.product_reviews
for each row execute function private.set_updated_at_phase18();
drop trigger if exists product_reviews_rating_sync on public.product_reviews;
create trigger product_reviews_rating_sync after insert or update or delete on public.product_reviews
for each row execute function private.product_review_rating_sync();

create or replace function private.record_review_analytics()
returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
  if tg_op='INSERT' then
    perform private.record_analytics_event('review_submitted','product',new.product_id,null,
      jsonb_build_object('rating',new.rating,'verified_purchase',new.verified_purchase),null);
  end if;
  return new;
end;
$$;

drop trigger if exists product_reviews_analytics on public.product_reviews;
create trigger product_reviews_analytics after insert on public.product_reviews
for each row execute function private.record_review_analytics();

-- Public/client functions are intentionally permissioned through auth.uid(), while sensitive writes run through SECURITY DEFINER internals.
create or replace function public.toggle_product_favorite(p_product_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=(select auth.uid()); v_exists boolean;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_product_id is null then raise exception 'product_id_required' using errcode='P0001'; end if;
  if not exists(select 1 from public.products p join public.vendors v on v.id=p.vendor_id where p.id=p_product_id and p.status='active' and v.status='active') then
    raise exception 'product_not_found' using errcode='P0001';
  end if;
  select exists(select 1 from public.favorite_products where user_id=v_user_id and product_id=p_product_id) into v_exists;
  if v_exists then delete from public.favorite_products where user_id=v_user_id and product_id=p_product_id;
  else insert into public.favorite_products(user_id,product_id) values(v_user_id,p_product_id); end if;
  return jsonb_build_object('product_id',p_product_id,'is_favorite',not v_exists);
end;
$$;
revoke all on function public.toggle_product_favorite(uuid) from public,anon;
grant execute on function public.toggle_product_favorite(uuid) to authenticated;

create or replace function public.list_my_favorite_ids()
returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$
select coalesce(jsonb_agg(fp.product_id order by fp.created_at desc),'[]'::jsonb)
from public.favorite_products fp where fp.user_id=(select auth.uid());
$$;
revoke all on function public.list_my_favorite_ids() from public,anon;
grant execute on function public.list_my_favorite_ids() to authenticated;

-- The remaining Phase 18 RPCs are the same live definitions captured in the release archive.
