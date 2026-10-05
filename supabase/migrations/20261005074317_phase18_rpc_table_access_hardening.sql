-- SHAKH 2027 — Phase 18 final RPC/table privilege hardening.
-- Applied as migration 20261005074317.
-- Public RPCs use SECURITY INVOKER; sensitive table reads/writes are isolated in private SECURITY DEFINER implementations.

create or replace function private.toggle_product_favorite(p_product_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=(select auth.uid()); v_exists boolean;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_product_id is null then raise exception 'product_id_required' using errcode='P0001'; end if;
  if not exists(select 1 from public.products p join public.vendors v on v.id=p.vendor_id where p.id=p_product_id and p.status='active' and v.status='active') then raise exception 'product_not_found' using errcode='P0001'; end if;
  select exists(select 1 from public.favorite_products where user_id=v_user_id and product_id=p_product_id) into v_exists;
  if v_exists then delete from public.favorite_products where user_id=v_user_id and product_id=p_product_id;
  else insert into public.favorite_products(user_id,product_id) values(v_user_id,p_product_id); end if;
  return jsonb_build_object('product_id',p_product_id,'is_favorite',not v_exists);
end; $$;
revoke all on function private.toggle_product_favorite(uuid) from public,anon,authenticated;
grant execute on function private.toggle_product_favorite(uuid) to authenticated;

create or replace function public.toggle_product_favorite(p_product_id uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.toggle_product_favorite(p_product_id); end; $$;
revoke all on function public.toggle_product_favorite(uuid) from public,anon;
grant execute on function public.toggle_product_favorite(uuid) to authenticated;

create or replace function private.list_my_favorite_ids()
returns jsonb language sql security definer set search_path=pg_catalog,public,private as $$
select coalesce(jsonb_agg(fp.product_id order by fp.created_at desc),'[]'::jsonb) from public.favorite_products fp where fp.user_id=(select auth.uid());
$$;
revoke all on function private.list_my_favorite_ids() from public,anon,authenticated;
grant execute on function private.list_my_favorite_ids() to authenticated;

create or replace function public.list_my_favorite_ids()
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.list_my_favorite_ids(); end; $$;
revoke all on function public.list_my_favorite_ids() from public,anon;
grant execute on function public.list_my_favorite_ids() to authenticated;

create or replace function private.list_my_favorite_products(p_limit integer default 60)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=(select auth.uid()); v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,60),100));
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.saved_at desc),'[]'::jsonb) into v_rows from (
    select p.id,p.slug,p.name_ckb,p.name_ar,p.name_en,p.base_price_iqd,p.compare_at_iqd,p.rating,p.review_count,p.is_in_stock,p.vendor_id,p.category_id,
           f.created_at as saved_at,v.name_ckb as vendor_name_ckb,v.name_ar as vendor_name_ar,v.name_en as vendor_name_en,
           (select pi.storage_path from public.product_images pi where pi.product_id=p.id order by pi.sort_order,pi.created_at limit 1) as image_storage_path
    from public.favorite_products f join public.products p on p.id=f.product_id join public.vendors v on v.id=p.vendor_id
    where f.user_id=v_user_id and p.status='active' and v.status='active' limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows,'count',coalesce(jsonb_array_length(v_rows),0));
end; $$;
revoke all on function private.list_my_favorite_products(integer) from public,anon,authenticated;
grant execute on function private.list_my_favorite_products(integer) to authenticated;

create or replace function public.list_my_favorite_products(p_limit integer default 60)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$
begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.list_my_favorite_products(p_limit); end; $$;
revoke all on function public.list_my_favorite_products(integer) from public,anon;
grant execute on function public.list_my_favorite_products(integer) to authenticated;

create or replace function private.list_product_reviews(p_product_id uuid,p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,30),100));
begin
  if p_product_id is null then raise exception 'product_id_required' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_rows from (
    select id,product_id,reviewer_display_name,rating,title,body,verified_purchase,created_at,updated_at
    from public.product_reviews where product_id=p_product_id and (status='published' or reviewer_user_id=(select auth.uid()))
    order by created_at desc limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows);
end; $$;
revoke all on function private.list_product_reviews(uuid,integer) from public,anon,authenticated;
grant execute on function private.list_product_reviews(uuid,integer) to anon,authenticated;

create or replace function public.list_product_reviews(p_product_id uuid,p_limit integer default 30)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin return private.list_product_reviews(p_product_id,p_limit); end; $$;
revoke all on function public.list_product_reviews(uuid,integer) from public;
grant execute on function public.list_product_reviews(uuid,integer) to anon,authenticated;

create or replace function private.list_reviewable_items(p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=(select auth.uid()); v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,50),100));
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.order_created_at desc,x.order_number),'[]'::jsonb) into v_rows from (
    select oi.id as order_item_id,o.id as order_id,o.order_number,o.created_at as order_created_at,oi.product_id,oi.variant_id,
           oi.product_name_ckb,oi.product_name_ar,oi.product_name_en,oi.image_storage_path,oi.quantity,oi.line_total_iqd
    from public.orders o join public.order_items oi on oi.order_id=o.id
    left join public.product_reviews pr on pr.product_id=oi.product_id and pr.reviewer_user_id=v_user_id
    where o.buyer_user_id=v_user_id and o.status='delivered' and pr.id is null
    order by o.created_at desc,o.order_number limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows);
end; $$;
revoke all on function private.list_reviewable_items(integer) from public,anon,authenticated;
grant execute on function private.list_reviewable_items(integer) to authenticated;

create or replace function public.list_reviewable_items(p_limit integer default 50)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.list_reviewable_items(p_limit); end; $$;
revoke all on function public.list_reviewable_items(integer) from public,anon;
grant execute on function public.list_reviewable_items(integer) to authenticated;

create or replace function private.create_product_review(p_product_id uuid,p_order_id uuid,p_rating integer,p_title text default null,p_body text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_user_id uuid:=(select auth.uid()); v_name text; v_review public.product_reviews%rowtype;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_product_id is null or p_order_id is null then raise exception 'product_and_order_required' using errcode='P0001'; end if;
  if p_rating is null or p_rating<1 or p_rating>5 then raise exception 'invalid_rating' using errcode='P0001'; end if;
  if length(trim(coalesce(p_title,'')))>120 then raise exception 'review_title_too_long' using errcode='P0001'; end if;
  if length(trim(coalesce(p_body,'')))>3000 then raise exception 'review_body_too_long' using errcode='P0001'; end if;
  if not exists(select 1 from public.products p join public.vendors v on v.id=p.vendor_id where p.id=p_product_id and p.status='active' and v.status='active') then raise exception 'product_not_found' using errcode='P0001'; end if;
  if not exists(select 1 from public.orders o join public.order_items oi on oi.order_id=o.id where o.id=p_order_id and o.buyer_user_id=v_user_id and o.status='delivered' and oi.product_id=p_product_id) then raise exception 'verified_purchase_required' using errcode='P0001'; end if;
  select coalesce(nullif(trim(full_name),''),'کڕیار') into v_name from public.profiles where id=v_user_id;
  insert into public.product_reviews(product_id,order_id,reviewer_user_id,reviewer_display_name,rating,title,body,status,verified_purchase)
  values(p_product_id,p_order_id,v_user_id,coalesce(v_name,'کڕیار'),p_rating,nullif(trim(coalesce(p_title,'')),''),nullif(trim(coalesce(p_body,'')),''),'published',true)
  returning * into v_review;
  return jsonb_build_object('item',jsonb_build_object('id',v_review.id,'product_id',v_review.product_id,'order_id',v_review.order_id,'reviewer_display_name',v_review.reviewer_display_name,'rating',v_review.rating,'title',v_review.title,'body',v_review.body,'verified_purchase',v_review.verified_purchase,'created_at',v_review.created_at));
exception when unique_violation then raise exception 'review_already_exists' using errcode='P0001';
end; $$;
revoke all on function private.create_product_review(uuid,uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.create_product_review(uuid,uuid,integer,text,text) to authenticated;

create or replace function public.create_product_review(p_product_id uuid,p_order_id uuid,p_rating integer,p_title text default null,p_body text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.create_product_review(p_product_id,p_order_id,p_rating,p_title,p_body); end; $$;
revoke all on function public.create_product_review(uuid,uuid,integer,text,text) from public,anon;
grant execute on function public.create_product_review(uuid,uuid,integer,text,text) to authenticated;

create or replace function private.update_product_review(p_review_id uuid,p_rating integer,p_title text default null,p_body text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_review public.product_reviews%rowtype;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_rating<1 or p_rating>5 then raise exception 'invalid_rating' using errcode='P0001'; end if;
  if length(trim(coalesce(p_title,'')))>120 then raise exception 'review_title_too_long' using errcode='P0001'; end if;
  if length(trim(coalesce(p_body,'')))>3000 then raise exception 'review_body_too_long' using errcode='P0001'; end if;
  update public.product_reviews set rating=p_rating,title=nullif(trim(coalesce(p_title,'')),''),body=nullif(trim(coalesce(p_body,'')),'') where id=p_review_id and reviewer_user_id=auth.uid() returning * into v_review;
  if not found then raise exception 'review_not_found' using errcode='P0001'; end if;
  return jsonb_build_object('item',to_jsonb(v_review));
end; $$;
revoke all on function private.update_product_review(uuid,integer,text,text) from public,anon,authenticated;
grant execute on function private.update_product_review(uuid,integer,text,text) to authenticated;

create or replace function public.update_product_review(p_review_id uuid,p_rating integer,p_title text default null,p_body text default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.update_product_review(p_review_id,p_rating,p_title,p_body); end; $$;
revoke all on function public.update_product_review(uuid,integer,text,text) from public,anon;
grant execute on function public.update_product_review(uuid,integer,text,text) to authenticated;

create or replace function private.set_product_review_status(p_review_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_review public.product_reviews%rowtype;
begin
  if not private.has_permission('reviews.manage') then raise exception 'reviews_manage_permission_required' using errcode='P0001'; end if;
  if p_status not in ('published','hidden','rejected') then raise exception 'invalid_review_status' using errcode='P0001'; end if;
  update public.product_reviews set status=p_status where id=p_review_id returning * into v_review;
  if not found then raise exception 'review_not_found' using errcode='P0001'; end if;
  return jsonb_build_object('item',to_jsonb(v_review));
end; $$;
revoke all on function private.set_product_review_status(uuid,text) from public,anon,authenticated;
grant execute on function private.set_product_review_status(uuid,text) to authenticated;

create or replace function public.set_product_review_status(p_review_id uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.set_product_review_status(p_review_id,p_status); end; $$;
revoke all on function public.set_product_review_status(uuid,text) from public,anon;
grant execute on function public.set_product_review_status(uuid,text) to authenticated;

create or replace function private.list_reviews_admin(p_limit integer default 100)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,100),250));
begin
  if not private.has_permission('reviews.manage') then raise exception 'reviews_manage_permission_required' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_rows from (
    select pr.id,pr.product_id,pr.order_id,pr.reviewer_user_id,pr.reviewer_display_name,pr.rating,pr.title,pr.body,pr.status,pr.verified_purchase,pr.created_at,pr.updated_at,
           p.name_ckb as product_name_ckb,p.name_ar as product_name_ar,p.name_en as product_name_en,o.order_number
    from public.product_reviews pr join public.products p on p.id=pr.product_id join public.orders o on o.id=pr.order_id
    order by pr.created_at desc limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows,'limit',v_limit);
end; $$;
revoke all on function private.list_reviews_admin(integer) from public,anon,authenticated;
grant execute on function private.list_reviews_admin(integer) to authenticated;

create or replace function public.list_reviews_admin(p_limit integer default 100)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private as $$ begin if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if; return private.list_reviews_admin(p_limit); end; $$;
revoke all on function public.list_reviews_admin(integer) from public,anon;
grant execute on function public.list_reviews_admin(integer) to authenticated;
