import { supabase } from '../../lib/supabase';

export type ProductReview = {
  id: string;
  product_id: string;
  order_id?: string;
  reviewer_display_name: string;
  rating: number;
  title: string | null;
  body: string | null;
  verified_purchase: boolean;
  created_at: string;
};

export type ReviewableItem = {
  order_item_id: string;
  order_id: string;
  order_number: string;
  order_created_at: string;
  product_id: string;
  variant_id: string | null;
  product_name_ckb: string;
  product_name_ar: string;
  product_name_en: string;
  image_storage_path: string | null;
  quantity: number;
  line_total_iqd: number;
};

export async function listProductReviews(productId: string, limit = 30): Promise<ProductReview[]> {
  const { data, error } = await supabase.rpc('list_product_reviews', { p_product_id: productId, p_limit: limit });
  if (error) throw new Error(`product_reviews_load_failed: ${error.message}`);
  const payload = data as { items?: ProductReview[] } | null;
  return (payload?.items ?? []).map((row) => ({ ...row, rating: Number(row.rating) }));
}

export async function listReviewableItems(limit = 50): Promise<ReviewableItem[]> {
  const { data, error } = await supabase.rpc('list_reviewable_items', { p_limit: limit });
  if (error) throw new Error(`reviewable_items_load_failed: ${error.message}`);
  const payload = data as { items?: ReviewableItem[] } | null;
  return (payload?.items ?? []).map((row) => ({ ...row, quantity: Number(row.quantity), line_total_iqd: Number(row.line_total_iqd) }));
}

export async function createProductReview(input: {
  productId: string;
  orderId: string;
  rating: number;
  title?: string;
  body?: string;
}) {
  const { data, error } = await supabase.rpc('create_product_review', {
    p_product_id: input.productId,
    p_order_id: input.orderId,
    p_rating: input.rating,
    p_title: input.title?.trim() || null,
    p_body: input.body?.trim() || null,
  });
  if (error) throw new Error(`review_create_failed: ${error.message}`);
  return data;
}
