-- SHAKH 2027 Phase 19 — Vendor Center + Product/Inventory management

create or replace function private.require_vendor_or_catalog_manager(p_vendor_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_vendor_id is null then raise exception 'vendor_id_required' using errcode='P0001'; end if;
  if not private.is_vendor_owner(p_vendor_id) and not private.has_permission('catalog.manage') then
    raise exception 'vendor_access_denied' using errcode='P0001';
  end if;
end;
$$;
revoke all on function private.require_vendor_or_catalog_manager(uuid) from public,anon,authenticated;
grant execute on function private.require_vendor_or_catalog_manager(uuid) to authenticated;

create or replace function private.get_vendor_center_snapshot(p_vendor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare
  v_selected uuid; v_vendor jsonb; v_vendors jsonb;
  v_products_count bigint; v_active_products bigint; v_low_stock_count bigint; v_out_of_stock_count bigint;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if private.has_permission('catalog.manage') then
    select coalesce(p_vendor_id,(select id from public.vendors order by created_at asc limit 1)) into v_selected;
  else
    select coalesce(p_vendor_id,(select id from public.vendors where owner_user_id=auth.uid() order by created_at asc limit 1)) into v_selected;
  end if;
  if v_selected is null then
    return jsonb_build_object('vendor',null,'vendors','[]'::jsonb,'stats',jsonb_build_object('products',0,'active_products',0,'low_stock',0,'out_of_stock',0),'generated_at',now());
  end if;
  perform private.require_vendor_or_catalog_manager(v_selected);
  select jsonb_build_object(
    'id',v.id,'owner_user_id',v.owner_user_id,'vendor_type',v.vendor_type,'slug',v.slug,
    'name_ckb',v.name_ckb,'name_ar',v.name_ar,'name_en',v.name_en,'description',v.description,
    'logo_url',v.logo_url,'status',v.status,'verified_at',v.verified_at,'latitude',v.latitude,
    'longitude',v.longitude,'service_radius_km',v.service_radius_km,'created_at',v.created_at,'updated_at',v.updated_at
  ) into v_vendor from public.vendors v where v.id=v_selected;
  select count(*),count(*) filter(where p.status='active'),count(*) filter(where p.status='active' and p.is_in_stock=false)
    into v_products_count,v_active_products,v_out_of_stock_count from public.products p where p.vendor_id=v_selected;
  select count(*) into v_low_stock_count
    from public.inventory i join public.product_variants pv on pv.id=i.variant_id join public.products p on p.id=pv.product_id
    where p.vendor_id=v_selected and pv.is_active=true and (i.quantity-i.reserved_quantity)>0 and (i.quantity-i.reserved_quantity)<=i.low_stock_threshold;
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb) into v_vendors
  from (
    select v.id,v.vendor_type,v.slug,v.name_ckb,v.name_ar,v.name_en,v.status,v.verified_at,v.created_at,
           count(p.id)::int product_count,count(p.id) filter(where p.status='active')::int active_product_count
    from public.vendors v left join public.products p on p.vendor_id=v.id
    where (private.has_permission('catalog.manage') or v.owner_user_id=auth.uid())
    group by v.id
  ) x;
  return jsonb_build_object('vendor',v_vendor,'vendors',v_vendors,'stats',jsonb_build_object(
    'products',v_products_count,'active_products',v_active_products,'low_stock',v_low_stock_count,'out_of_stock',v_out_of_stock_count
  ),'generated_at',now());
end;
$$;
revoke all on function private.get_vendor_center_snapshot(uuid) from public,anon,authenticated;
grant execute on function private.get_vendor_center_snapshot(uuid) to authenticated;

create or replace function public.get_vendor_center_snapshot(p_vendor_id uuid default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.get_vendor_center_snapshot(p_vendor_id); end; $$;
revoke all on function public.get_vendor_center_snapshot(uuid) from public,anon;
grant execute on function public.get_vendor_center_snapshot(uuid) to authenticated;

create or replace function private.list_vendor_products(p_vendor_id uuid,p_status text default null,p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_rows jsonb; v_limit integer:=greatest(1,least(coalesce(p_limit,100),250));
begin
  perform private.require_vendor_or_catalog_manager(p_vendor_id);
  if p_status is not null and p_status not in ('draft','active','archived') then raise exception 'invalid_product_status' using errcode='P0001'; end if;
  select coalesce(jsonb_agg(x order by x.updated_at desc),'[]'::jsonb) into v_rows
  from (
    select p.id,p.vendor_id,p.category_id,p.slug,p.name_ckb,p.name_ar,p.name_en,p.description_ckb,p.description_ar,p.description_en,
           p.base_price_iqd,p.compare_at_iqd,p.status,p.is_featured,p.rating,p.review_count,p.is_in_stock,p.created_at,p.updated_at,
           c.name_ckb category_name_ckb,c.name_ar category_name_ar,c.name_en category_name_en,
           (select jsonb_build_object('id',pv.id,'sku',pv.sku,'label_ckb',pv.label_ckb,'label_ar',pv.label_ar,'label_en',pv.label_en,
                    'price_iqd',pv.price_iqd,'compare_at_iqd',pv.compare_at_iqd,'is_active',pv.is_active,
                    'quantity',coalesce(i.quantity,0),'reserved_quantity',coalesce(i.reserved_quantity,0),
                    'available_quantity',coalesce(i.quantity-i.reserved_quantity,0),'low_stock_threshold',coalesce(i.low_stock_threshold,5))
             from public.product_variants pv left join public.inventory i on i.variant_id=pv.id
             where pv.product_id=p.id order by pv.created_at asc limit 1) primary_variant
    from public.products p left join public.categories c on c.id=p.category_id
    where p.vendor_id=p_vendor_id and (p_status is null or p.status=p_status)
    order by p.updated_at desc limit v_limit
  ) x;
  return jsonb_build_object('items',v_rows,'vendor_id',p_vendor_id,'limit',v_limit);
end;
$$;
revoke all on function private.list_vendor_products(uuid,text,integer) from public,anon,authenticated;
grant execute on function private.list_vendor_products(uuid,text,integer) to authenticated;

create or replace function public.list_vendor_products(p_vendor_id uuid,p_status text default null,p_limit integer default 100)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.list_vendor_products(p_vendor_id,p_status,p_limit); end; $$;
revoke all on function public.list_vendor_products(uuid,text,integer) from public,anon;
grant execute on function public.list_vendor_products(uuid,text,integer) to authenticated;

create or replace function private.create_vendor_product(
  p_vendor_id uuid,p_slug text,p_name_ckb text,p_name_ar text,p_name_en text,p_base_price_iqd numeric,
  p_category_id uuid default null,p_description_ckb text default null,p_description_ar text default null,p_description_en text default null,
  p_variant_label_ckb text default 'سەرەکی',p_variant_label_ar text default 'الرئيسي',p_variant_label_en text default 'Default',
  p_variant_price_iqd numeric default null,p_quantity integer default 0,p_low_stock_threshold integer default 5,p_status text default 'draft'
)
returns jsonb
language plpgsql
security definer
set search_path=pg_catalog,public,private
as $$
declare v_product public.products%rowtype; v_variant public.product_variants%rowtype; v_vendor public.vendors%rowtype;
        v_price numeric(14,2):=coalesce(p_variant_price_iqd,p_base_price_iqd); v_is_manager boolean:=private.has_permission('catalog.manage');
begin
  perform private.require_vendor_or_catalog_manager(p_vendor_id);
  select * into v_vendor from public.vendors where id=p_vendor_id;
  if not found then raise exception 'vendor_not_found' using errcode='P0001'; end if;
  if p_status not in ('draft','active') then raise exception 'invalid_create_product_status' using errcode='P0001'; end if;
  if p_status='active' and not v_is_manager and (v_vendor.status<>'active' or v_vendor.verified_at is null) then raise exception 'vendor_verification_required_for_publish' using errcode='P0001'; end if;
  if p_slug is null or length(trim(p_slug))<2 or length(trim(p_slug))>100 or position(' ' in trim(p_slug))>0 then raise exception 'invalid_product_slug' using errcode='P0001'; end if;
  if p_name_ckb is null or p_name_ar is null or p_name_en is null then raise exception 'product_names_required' using errcode='P0001'; end if;
  if p_base_price_iqd is null or p_base_price_iqd<0 or v_price<0 then raise exception 'invalid_product_price' using errcode='P0001'; end if;
  if p_quantity<0 or p_low_stock_threshold<0 then raise exception 'invalid_inventory_values' using errcode='P0001'; end if;
  insert into public.products(vendor_id,category_id,slug,name_ckb,name_ar,name_en,description_ckb,description_ar,description_en,base_price_iqd,status,is_featured,review_count,is_in_stock)
  values(p_vendor_id,p_category_id,trim(p_slug),trim(p_name_ckb),trim(p_name_ar),trim(p_name_en),nullif(trim(coalesce(p_description_ckb,'')),''),nullif(trim(coalesce(p_description_ar,'')),''),nullif(trim(coalesce(p_description_en,'')),''),round(p_base_price_iqd,2),p_status,false,0,false)
  returning * into v_product;
  insert into public.product_variants(product_id,sku,label_ckb,label_ar,label_en,price_iqd,compare_at_iqd,attributes,is_active)
  values(v_product.id,null,trim(p_variant_label_ckb),trim(p_variant_label_ar),trim(p_variant_label_en),round(v_price,2),null,'{}'::jsonb,true)
  returning * into v_variant;
  insert into public.inventory(variant_id,quantity,reserved_quantity,low_stock_threshold) values(v_variant.id,p_quantity,0,p_low_stock_threshold);
  update public.products set is_in_stock=(p_quantity>0),updated_at=now() where id=v_product.id;
  return jsonb_build_object('product_id',v_product.id,'variant_id',v_variant.id,'status',p_status,'quantity',p_quantity,'available_quantity',p_quantity);
exception when unique_violation then raise exception 'product_slug_already_exists' using errcode='P0001'; end;
$$;
revoke all on function private.create_vendor_product(uuid,text,text,text,text,numeric,uuid,text,text,text,text,text,text,numeric,integer,integer,text) from public,anon,authenticated;
grant execute on function private.create_vendor_product(uuid,text,text,text,text,numeric,uuid,text,text,text,text,text,text,numeric,integer,integer,text) to authenticated;

create or replace function public.create_vendor_product(
  p_vendor_id uuid,p_slug text,p_name_ckb text,p_name_ar text,p_name_en text,p_base_price_iqd numeric,
  p_category_id uuid default null,p_description_ckb text default null,p_description_ar text default null,p_description_en text default null,
  p_variant_label_ckb text default 'سەرەکی',p_variant_label_ar text default 'الرئيسي',p_variant_label_en text default 'Default',
  p_variant_price_iqd numeric default null,p_quantity integer default 0,p_low_stock_threshold integer default 5,p_status text default 'draft'
)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.create_vendor_product(p_vendor_id,p_slug,p_name_ckb,p_name_ar,p_name_en,p_base_price_iqd,p_category_id,p_description_ckb,p_description_ar,p_description_en,p_variant_label_ckb,p_variant_label_ar,p_variant_label_en,p_variant_price_iqd,p_quantity,p_low_stock_threshold,p_status); end; $$;
revoke all on function public.create_vendor_product(uuid,text,text,text,text,numeric,uuid,text,text,text,text,text,text,numeric,integer,integer,text) from public,anon;
grant execute on function public.create_vendor_product(uuid,text,text,text,text,numeric,uuid,text,text,text,text,text,text,numeric,integer,integer,text) to authenticated;

create or replace function private.update_vendor_inventory(p_variant_id uuid,p_quantity integer,p_low_stock_threshold integer default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_product_id uuid; v_vendor_id uuid; v_inventory public.inventory%rowtype; v_threshold integer; v_available integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_variant_id is null then raise exception 'variant_id_required' using errcode='P0001'; end if;
  if p_quantity<0 then raise exception 'invalid_inventory_quantity' using errcode='P0001'; end if;
  select pv.product_id,p.vendor_id into v_product_id,v_vendor_id from public.product_variants pv join public.products p on p.id=pv.product_id where pv.id=p_variant_id;
  if not found then raise exception 'variant_not_found' using errcode='P0001'; end if;
  perform private.require_vendor_or_catalog_manager(v_vendor_id);
  select * into v_inventory from public.inventory where variant_id=p_variant_id for update;
  v_threshold:=coalesce(p_low_stock_threshold,v_inventory.low_stock_threshold,5);
  if v_threshold<0 then raise exception 'invalid_low_stock_threshold' using errcode='P0001'; end if;
  if not found then
    insert into public.inventory(variant_id,quantity,reserved_quantity,low_stock_threshold) values(p_variant_id,p_quantity,0,v_threshold) returning * into v_inventory;
  else
    if p_quantity<v_inventory.reserved_quantity then raise exception 'quantity_below_reserved' using errcode='P0001'; end if;
    update public.inventory set quantity=p_quantity,low_stock_threshold=v_threshold,updated_at=now() where variant_id=p_variant_id returning * into v_inventory;
  end if;
  v_available:=v_inventory.quantity-v_inventory.reserved_quantity;
  update public.products set is_in_stock=exists(select 1 from public.product_variants pv join public.inventory i on i.variant_id=pv.id where pv.product_id=v_product_id and pv.is_active=true and (i.quantity-i.reserved_quantity)>0),updated_at=now() where id=v_product_id;
  return jsonb_build_object('variant_id',v_inventory.variant_id,'quantity',v_inventory.quantity,'reserved_quantity',v_inventory.reserved_quantity,'available_quantity',v_available,'low_stock_threshold',v_inventory.low_stock_threshold,'is_low_stock',(v_available>0 and v_available<=v_inventory.low_stock_threshold),'is_out_of_stock',(v_available<=0));
end;
$$;
revoke all on function private.update_vendor_inventory(uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.update_vendor_inventory(uuid,integer,integer) to authenticated;

create or replace function public.update_vendor_inventory(p_variant_id uuid,p_quantity integer,p_low_stock_threshold integer default null)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.update_vendor_inventory(p_variant_id,p_quantity,p_low_stock_threshold); end; $$;
revoke all on function public.update_vendor_inventory(uuid,integer,integer) from public,anon;
grant execute on function public.update_vendor_inventory(uuid,integer,integer) to authenticated;

create or replace function private.set_vendor_product_status(p_product_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private
as $$
declare v_row public.products%rowtype; v_vendor public.vendors%rowtype; v_manager boolean:=private.has_permission('catalog.manage');
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_status not in ('draft','active','archived') then raise exception 'invalid_product_status' using errcode='P0001'; end if;
  select v.* into v_vendor from public.products p join public.vendors v on v.id=p.vendor_id where p.id=p_product_id;
  if not found then raise exception 'product_not_found' using errcode='P0001'; end if;
  if not private.is_vendor_owner(v_vendor.id) and not v_manager then raise exception 'vendor_access_denied' using errcode='P0001'; end if;
  if p_status='active' and not v_manager and (v_vendor.status<>'active' or v_vendor.verified_at is null) then raise exception 'vendor_verification_required_for_publish' using errcode='P0001'; end if;
  update public.products set status=p_status,updated_at=now() where id=p_product_id returning * into v_row;
  return jsonb_build_object('product_id',v_row.id,'status',v_row.status);
end;
$$;
revoke all on function private.set_vendor_product_status(uuid,text) from public,anon,authenticated;
grant execute on function private.set_vendor_product_status(uuid,text) to authenticated;

create or replace function public.set_vendor_product_status(p_product_id uuid,p_status text)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public,private
as $$ begin return private.set_vendor_product_status(p_product_id,p_status); end; $$;
revoke all on function public.set_vendor_product_status(uuid,text) from public,anon;
grant execute on function public.set_vendor_product_status(uuid,text) to authenticated;
