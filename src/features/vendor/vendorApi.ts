import { supabase } from '../../lib/supabase';
import type { ManagedOrderSummary } from '../commerce/orderManagementApi';

export type VendorCenterVendor = {
  id: string;
  vendor_type: string;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  status: string;
  verified_at: string | null;
  created_at: string;
  product_count: number;
  active_product_count: number;
};

export type VendorCenterSnapshot = {
  vendor: {
    id: string;
    owner_user_id: string;
    vendor_type: string;
    slug: string;
    name_ckb: string;
    name_ar: string;
    name_en: string;
    description: string | null;
    logo_url: string | null;
    status: string;
    verified_at: string | null;
    service_radius_km: number;
  } | null;
  vendors: VendorCenterVendor[];
  stats: { products: number; active_products: number; low_stock: number; out_of_stock: number };
  generated_at: string;
};

export type VendorProduct = {
  id: string;
  vendor_id: string;
  category_id: string | null;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  base_price_iqd: number;
  compare_at_iqd: number | null;
  status: 'draft' | 'active' | 'archived';
  is_featured: boolean;
  rating: number | null;
  review_count: number;
  is_in_stock: boolean;
  category_name_ckb: string | null;
  primary_variant: {
    id: string;
    sku: string | null;
    label_ckb: string;
    label_ar: string;
    label_en: string;
    price_iqd: number;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    low_stock_threshold: number;
  } | null;
  created_at: string;
  updated_at: string;
};

export async function getVendorCenterSnapshot(vendorId?: string | null): Promise<VendorCenterSnapshot> {
  const { data, error } = await supabase.rpc('get_vendor_center_snapshot', { p_vendor_id: vendorId ?? null });
  if (error) throw new Error(`vendor_snapshot_load_failed: ${error.message}`);
  return data as VendorCenterSnapshot;
}

export async function listVendorProducts(vendorId: string, status?: string | null): Promise<VendorProduct[]> {
  const { data, error } = await supabase.rpc('list_vendor_products', { p_vendor_id: vendorId, p_status: status ?? null, p_limit: 250 });
  if (error) throw new Error(`vendor_products_load_failed: ${error.message}`);
  const rows = ((data as { items?: VendorProduct[] } | null)?.items ?? []);
  return rows.map((row) => ({
    ...row,
    base_price_iqd: Number(row.base_price_iqd),
    compare_at_iqd: row.compare_at_iqd == null ? null : Number(row.compare_at_iqd),
    rating: row.rating == null ? null : Number(row.rating),
    review_count: Number(row.review_count),
    primary_variant: row.primary_variant
      ? {
          ...row.primary_variant,
          price_iqd: Number(row.primary_variant.price_iqd),
          quantity: Number(row.primary_variant.quantity),
          reserved_quantity: Number(row.primary_variant.reserved_quantity),
          available_quantity: Number(row.primary_variant.available_quantity),
          low_stock_threshold: Number(row.primary_variant.low_stock_threshold),
        }
      : null,
  }));
}

export async function createVendorProduct(input: {
  vendorId: string;
  slug: string;
  nameCkb: string;
  nameAr: string;
  nameEn: string;
  basePriceIqd: number;
  categoryId?: string | null;
  descriptionCkb?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  variantLabelCkb?: string;
  variantLabelAr?: string;
  variantLabelEn?: string;
  variantPriceIqd?: number | null;
  quantity?: number;
  lowStockThreshold?: number;
  status?: 'draft' | 'active';
}) {
  const { data, error } = await supabase.rpc('create_vendor_product', {
    p_vendor_id: input.vendorId,
    p_slug: input.slug,
    p_name_ckb: input.nameCkb,
    p_name_ar: input.nameAr,
    p_name_en: input.nameEn,
    p_base_price_iqd: input.basePriceIqd,
    p_category_id: input.categoryId ?? null,
    p_description_ckb: input.descriptionCkb?.trim() || null,
    p_description_ar: input.descriptionAr?.trim() || null,
    p_description_en: input.descriptionEn?.trim() || null,
    p_variant_label_ckb: input.variantLabelCkb?.trim() || 'سەرەکی',
    p_variant_label_ar: input.variantLabelAr?.trim() || 'الرئيسي',
    p_variant_label_en: input.variantLabelEn?.trim() || 'Default',
    p_variant_price_iqd: input.variantPriceIqd ?? null,
    p_quantity: input.quantity ?? 0,
    p_low_stock_threshold: input.lowStockThreshold ?? 5,
    p_status: input.status ?? 'draft',
  });
  if (error) throw new Error(`vendor_product_create_failed: ${error.message}`);
  return data as { product_id: string; variant_id: string; status: string; quantity: number };
}

export async function updateVendorInventory(variantId: string, quantity: number, lowStockThreshold?: number): Promise<void> {
  const { error } = await supabase.rpc('update_vendor_inventory', {
    p_variant_id: variantId,
    p_quantity: quantity,
    p_low_stock_threshold: lowStockThreshold ?? null,
  });
  if (error) throw new Error(`vendor_inventory_update_failed: ${error.message}`);
}

export async function setVendorProductStatus(productId: string, status: 'draft' | 'active' | 'archived'): Promise<void> {
  const { error } = await supabase.rpc('set_vendor_product_status', { p_product_id: productId, p_status: status });
  if (error) throw new Error(`vendor_product_status_failed: ${error.message}`);
}

export async function listVendorOrders(vendorId: string, status?: string | null): Promise<ManagedOrderSummary[]> {
  const { data, error } = await supabase.rpc('list_vendor_orders', { p_vendor_id: vendorId, p_status: status ?? null, p_limit: 250 });
  if (error) throw new Error(`vendor_orders_load_failed: ${error.message}`);
  return (((data as { items?: ManagedOrderSummary[] } | null)?.items ?? []) as ManagedOrderSummary[]).map((row) => ({ ...row, subtotal_iqd: Number(row.subtotal_iqd), delivery_fee_iqd: Number(row.delivery_fee_iqd), discount_iqd: Number(row.discount_iqd), total_iqd: Number(row.total_iqd), item_count: Number(row.item_count), total_items: Number(row.total_items) }));
}

export async function updateVendorOrderStatus(orderId: string, status: 'confirmed' | 'processing' | 'ready_for_pickup' | 'cancelled', note?: string) {
  const { data, error } = await supabase.rpc('update_vendor_order_status', { p_order_id: orderId, p_next_status: status, p_note: note?.trim() || null });
  if (error) throw new Error(`vendor_order_status_failed: ${error.message}`);
  return data as { order_id: string; order_number: string; status: string };
}
