import { supabase } from '../../lib/supabase';

export type FavoriteProduct = {
  id: string;
  slug: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  base_price_iqd: number;
  compare_at_iqd: number | null;
  rating: number | null;
  review_count: number;
  is_in_stock: boolean;
  vendor_id: string;
  category_id: string | null;
  saved_at: string;
  vendor_name_ckb: string;
  vendor_name_ar: string;
  vendor_name_en: string;
  image_storage_path: string | null;
};

export async function listFavoriteIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('list_my_favorite_ids');
  if (error) throw new Error(`favorite_ids_load_failed: ${error.message}`);
  return Array.isArray(data) ? data.map(String) : [];
}

export async function listFavoriteProducts(limit = 60): Promise<FavoriteProduct[]> {
  const { data, error } = await supabase.rpc('list_my_favorite_products', { p_limit: limit });
  if (error) throw new Error(`favorite_products_load_failed: ${error.message}`);
  const payload = data as { items?: FavoriteProduct[] } | null;
  return (payload?.items ?? []).map((row) => ({ ...row, base_price_iqd: Number(row.base_price_iqd), compare_at_iqd: row.compare_at_iqd === null ? null : Number(row.compare_at_iqd), rating: row.rating === null ? null : Number(row.rating), review_count: Number(row.review_count) }));
}

export async function toggleProductFavorite(productId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('toggle_product_favorite', { p_product_id: productId });
  if (error) throw new Error(`favorite_toggle_failed: ${error.message}`);
  return Boolean((data as { is_favorite?: boolean } | null)?.is_favorite);
}
