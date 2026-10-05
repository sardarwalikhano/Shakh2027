import { supabase } from '../../lib/supabase';
import type { MarketplaceFilters, ProductDetails, ProductSummary } from '../marketplace/catalog';

export type CatalogCategory = {
  id: string;
  slug: string;
  nameCkb: string;
  nameAr: string;
  nameEn: string;
};

type CategoryRow = {
  id: string;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
};


type VendorRow = {
  id: string;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  vendor_type: string;
};

type GlobalSearchResponse = {
  query: string;
  products: Array<{
    id: string; slug: string; name_ckb: string; name_ar: string; name_en: string;
    description_ckb: string | null; description_ar: string | null; description_en: string | null;
    base_price_iqd: number; compare_at_iqd: number | null; rating: number | null; review_count: number;
    is_in_stock: boolean; vendor_id: string; category_id: string | null;
    vendor_name_ckb: string | null; vendor_name_ar: string | null; vendor_name_en: string | null;
    category_name_ckb: string | null; category_name_ar: string | null; category_name_en: string | null;
    image_storage_path: string | null; created_at: string;
  }>;
  vendors: unknown[];
  categories: unknown[];
};

type ProductRow = {
  id: string;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  description_ckb: string | null;
  description_ar: string | null;
  description_en: string | null;
  base_price_iqd: number;
  compare_at_iqd: number | null;
  rating: number | null;
  review_count: number;
  is_in_stock: boolean;
  vendor_id: string;
  category_id: string | null;
  vendors: { name_ckb: string; name_ar: string; name_en: string } | null;
  categories: { name_ckb: string; name_ar: string; name_en: string } | null;
  seo_title_ckb?: string | null;
  seo_title_ar?: string | null;
  seo_title_en?: string | null;
  seo_description_ckb?: string | null;
  seo_description_ar?: string | null;
  seo_description_en?: string | null;
  product_images: Array<{
    id: string;
    storage_path: string;
    alt_ckb: string | null;
    alt_ar: string | null;
    alt_en: string | null;
    sort_order: number;
  }>;
};

type VariantRow = {
  id: string;
  label_ckb: string;
  label_ar: string;
  label_en: string;
  price_iqd: number;
  is_active: boolean;
  attributes: Record<string, unknown>;
  inventory: { quantity: number; reserved_quantity: number } | null;
};

function localizeCkb(nameCkb: string, nameAr: string, nameEn: string): string {
  return nameCkb || nameAr || nameEn;
}

function toSummary(row: ProductRow): ProductSummary {
  const firstImage = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order)[0];
  return {
    id: row.id,
    title: localizeCkb(row.name_ckb, row.name_ar, row.name_en),
    slug: row.slug,
    priceIqd: Number(row.base_price_iqd),
    compareAtIqd: row.compare_at_iqd === null ? null : Number(row.compare_at_iqd),
    currency: 'IQD',
    rating: row.rating === null ? null : Number(row.rating),
    reviewCount: row.review_count,
    image: firstImage
      ? {
          id: firstImage.id,
          url: '',
          alt: localizeCkb(firstImage.alt_ckb ?? '', firstImage.alt_ar ?? '', firstImage.alt_en ?? ''),
        }
      : null,
    vendorName: row.vendors ? localizeCkb(row.vendors.name_ckb, row.vendors.name_ar, row.vendors.name_en) : null,
    categoryName: row.categories ? localizeCkb(row.categories.name_ckb, row.categories.name_ar, row.categories.name_en) : null,
    badge: row.is_in_stock ? null : 'نەماوە',
    seoTitle: localizeCkb(row.seo_title_ckb ?? '', row.seo_title_ar ?? '', row.seo_title_en ?? '') || null,
    seoDescription: localizeCkb(row.seo_description_ckb ?? '', row.seo_description_ar ?? '', row.seo_description_en ?? '') || null,
  };
}

export async function getActiveCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id,slug,name_ckb,name_ar,name_en')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name_ckb', { ascending: true });

  if (error) throw new Error(`categories_load_failed: ${error.message}`);
  return ((data ?? []) as CategoryRow[]).map((row) => ({
    id: row.id,
    slug: row.slug,
    nameCkb: row.name_ckb,
    nameAr: row.name_ar,
    nameEn: row.name_en,
  }));
}

export async function getActiveVendors(): Promise<VendorRow[]> {
  const { data, error } = await supabase
    .from('vendors')
    .select('id,slug,name_ckb,name_ar,name_en,vendor_type')
    .eq('status', 'active')
    .order('name_ckb', { ascending: true });
  if (error) throw new Error(`vendors_load_failed: ${error.message}`);
  return (data ?? []) as VendorRow[];
}

function sortProducts(rows: ProductSummary[], sort: MarketplaceFilters['sort']) {
  return [...rows].sort((a, b) => {
    if (sort === 'price_asc') return a.priceIqd - b.priceIqd;
    if (sort === 'price_desc') return b.priceIqd - a.priceIqd;
    if (sort === 'rating') return Number(b.rating ?? -1) - Number(a.rating ?? -1);
    return 0;
  });
}

function fromGlobalSearch(row: GlobalSearchResponse['products'][number]): ProductSummary {
  return {
    id: row.id,
    title: localizeCkb(row.name_ckb, row.name_ar, row.name_en),
    slug: row.slug,
    priceIqd: Number(row.base_price_iqd),
    compareAtIqd: row.compare_at_iqd === null ? null : Number(row.compare_at_iqd),
    currency: 'IQD', rating: row.rating === null ? null : Number(row.rating), reviewCount: row.review_count,
    image: row.image_storage_path ? { id: `${row.id}:primary`, url: '', alt: localizeCkb(row.name_ckb, row.name_ar, row.name_en) } : null,
    vendorName: localizeCkb(row.vendor_name_ckb ?? '', row.vendor_name_ar ?? '', row.vendor_name_en ?? '') || null,
    categoryName: localizeCkb(row.category_name_ckb ?? '', row.category_name_ar ?? '', row.category_name_en ?? '') || null,
    badge: row.is_in_stock ? null : 'نەماوە',
  };
}

export async function getMarketplaceProducts(filters: MarketplaceFilters): Promise<ProductSummary[]> {
  const normalizedQuery = filters.query.trim();
  if (normalizedQuery) {
    const { data, error } = await supabase.rpc('global_search', {
      p_query: normalizedQuery,
      p_category_id: filters.categoryId,
      p_min_price: filters.minPrice,
      p_max_price: filters.maxPrice,
      p_only_available: filters.onlyAvailable,
      p_limit: 60,
    });
    if (error) throw new Error(`products_search_failed: ${error.message}`);
    const payload = data as GlobalSearchResponse;
    return sortProducts((payload.products ?? []).map(fromGlobalSearch), filters.sort);
  }

  let query = supabase
    .from('products')
    .select(`
      id, slug, name_ckb, name_ar, name_en,
      description_ckb, description_ar, description_en,
      seo_title_ckb, seo_title_ar, seo_title_en,
      seo_description_ckb, seo_description_ar, seo_description_en,
      base_price_iqd, compare_at_iqd, rating, review_count,
      is_in_stock, vendor_id, category_id,
      vendors!inner(name_ckb,name_ar,name_en,status),
      categories(name_ckb,name_ar,name_en),
      product_images(id,storage_path,alt_ckb,alt_ar,alt_en,sort_order)
    `)
    .eq('status', 'active').eq('vendors.status', 'active').limit(100);
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
  if (filters.minPrice !== null) query = query.gte('base_price_iqd', filters.minPrice);
  if (filters.maxPrice !== null) query = query.lte('base_price_iqd', filters.maxPrice);
  if (filters.onlyAvailable) query = query.eq('is_in_stock', true);
  switch (filters.sort) {
    case 'newest': query = query.order('created_at', { ascending: false }); break;
    case 'price_asc': query = query.order('base_price_iqd', { ascending: true }); break;
    case 'price_desc': query = query.order('base_price_iqd', { ascending: false }); break;
    case 'rating': query = query.order('rating', { ascending: false, nullsFirst: false }); break;
    default: query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) throw new Error(`products_load_failed: ${error.message}`);
  return ((data ?? []) as unknown as ProductRow[]).map(toSummary);
}

export async function getProductDetailsBySlugOrId(slugOrId: string): Promise<ProductDetails> {
  const value = slugOrId.trim();
  if (!value) throw new Error('product_key_required');

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const column = uuidPattern.test(value) ? 'id' : 'slug';
  const { data, error } = await supabase
    .from('products')
    .select('id')
    .eq(column, value)
    .eq('status', 'active')
    .maybeSingle();

  if (error) throw new Error(`product_lookup_failed: ${error.message}`);
  if (!data?.id) throw new Error('product_not_found');

  return getProductDetails(data.id);
}

export async function getProductDetails(productId: string): Promise<ProductDetails> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      id, slug, name_ckb, name_ar, name_en,
      description_ckb, description_ar, description_en,
      seo_title_ckb, seo_title_ar, seo_title_en,
      seo_description_ckb, seo_description_ar, seo_description_en,
      base_price_iqd, compare_at_iqd, rating, review_count,
      is_in_stock, vendor_id, category_id,
      vendors!inner(id,name_ckb,name_ar,name_en,status),
      categories(name_ckb,name_ar,name_en),
      product_images(id,storage_path,alt_ckb,alt_ar,alt_en,sort_order),
      product_variants(id,label_ckb,label_ar,label_en,price_iqd,is_active,attributes,inventory(quantity,reserved_quantity))
    `)
    .eq('id', productId)
    .eq('status', 'active')
    .eq('vendors.status', 'active')
    .single();

  if (error) throw new Error(`product_detail_failed: ${error.message}`);
  const row = data as unknown as ProductRow & { product_variants: VariantRow[]; vendors: { id: string; name_ckb: string; name_ar: string; name_en: string } };
  const summary = toSummary(row);
  return {
    ...summary,
    description: localizeCkb(row.description_ckb ?? '', row.description_ar ?? '', row.description_en ?? ''),
    images: [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order).map((image) => ({
      id: image.id,
      url: '',
      alt: localizeCkb(image.alt_ckb ?? '', image.alt_ar ?? '', image.alt_en ?? ''),
    })),
    variants: (row.product_variants ?? []).filter((variant) => variant.is_active).map((variant) => ({
      id: variant.id,
      label: 'بژاردە',
      value: localizeCkb(variant.label_ckb, variant.label_ar, variant.label_en),
      available: Boolean(variant.inventory && variant.inventory.quantity > variant.inventory.reserved_quantity),
    })),
    seller: row.vendors
      ? { id: row.vendors.id, name: localizeCkb(row.vendors.name_ckb, row.vendors.name_ar, row.vendors.name_en) }
      : null,
  };
}
