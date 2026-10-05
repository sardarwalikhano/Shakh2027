-- SHAKH 2027 Phase 10 — Commerce catalog foundation
-- Applied remotely as commerce_catalog_foundation_v1,
-- catalog_stock_signal_v1 and catalog_stock_signal_hardening_v1.

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  slug text not null unique,
  name_ckb text not null,
  name_ar text not null,
  name_en text not null,
  icon_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  vendor_type text not null check (vendor_type in ('restaurant','supermarket','fashion','car','umrah','beauty','general')),
  slug text not null unique,
  name_ckb text not null,
  name_ar text not null,
  name_en text not null,
  description text,
  logo_url text,
  status text not null default 'pending' check (status in ('pending','active','suspended')),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  slug text not null,
  name_ckb text not null,
  name_ar text not null,
  name_en text not null,
  description_ckb text,
  description_ar text,
  description_en text,
  base_price_iqd numeric(14,2) not null check (base_price_iqd >= 0),
  compare_at_iqd numeric(14,2) check (compare_at_iqd is null or compare_at_iqd >= base_price_iqd),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  is_featured boolean not null default false,
  rating numeric(3,2) check (rating is null or (rating >= 0 and rating <= 5)),
  review_count integer not null default 0 check (review_count >= 0),
  is_in_stock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, slug)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  alt_ckb text,
  alt_ar text,
  alt_en text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, storage_path)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text,
  label_ckb text not null,
  label_ar text not null,
  label_en text not null,
  price_iqd numeric(14,2) not null check (price_iqd >= 0),
  compare_at_iqd numeric(14,2) check (compare_at_iqd is null or compare_at_iqd >= price_iqd),
  attributes jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, sku)
);

create table if not exists public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity integer not null default 0 check (quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null default 'ناونیشانی ماڵ',
  recipient_name text not null,
  phone text not null,
  city text not null default 'هەولێر',
  district text not null,
  street text,
  landmark text,
  latitude double precision,
  longitude double precision,
  notes text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_latitude check (latitude is null or latitude between -90 and 90),
  constraint valid_longitude check (longitude is null or longitude between -180 and 180)
);

create unique index if not exists one_default_address_per_user on public.addresses(user_id) where is_default = true;

create table if not exists public.cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, variant_id)
);

create index if not exists idx_categories_parent_id on public.categories(parent_id);
create index if not exists idx_vendors_owner_user_id on public.vendors(owner_user_id);
create index if not exists idx_vendors_status_type on public.vendors(status, vendor_type);
create index if not exists idx_products_vendor_id on public.products(vendor_id);
create index if not exists idx_products_category_id on public.products(category_id);
create index if not exists idx_products_status_featured on public.products(status, is_featured);
create index if not exists idx_product_images_product_id on public.product_images(product_id);
create index if not exists idx_product_variants_product_id on public.product_variants(product_id);
create index if not exists idx_addresses_user_id on public.addresses(user_id);
create index if not exists idx_cart_items_user_id on public.cart_items(user_id);

-- RLS, functions and grants are represented in the remote migration history.
-- The runtime policy contract is documented in docs/PHASE_10_COMMERCE_CATALOG.md.
