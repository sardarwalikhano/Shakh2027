import { supabase } from '../../lib/supabase';

export type PromotionType = 'automatic' | 'coupon';
export type DiscountType = 'percentage' | 'fixed';

export type Promotion = {
  id: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  description_ckb?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_iqd: number | null;
  min_subtotal_iqd: number;
  vendor_id: string | null;
  category_id: string | null;
  priority: number;
  starts_at: string;
  ends_at: string | null;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  coupons?: CouponCode[];
};

export type CouponCode = {
  id: string;
  code: string;
  usage_limit: number | null;
  usage_count: number;
  per_user_limit: number;
  is_active: boolean;
  created_at: string;
};

export type CouponValidation = {
  valid: boolean;
  reason: string | null;
  code?: string | null;
  coupon_id?: string | null;
  promotion_id?: string | null;
  discount_iqd: number;
  subtotal_iqd?: number;
  eligible_subtotal_iqd?: number;
  promotion_type?: PromotionType | null;
  discount_type?: DiscountType | null;
  discount_value?: number | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizePromotion(value: unknown): Promotion {
  const row = asRecord(value);
  return {
    id: String(row.id ?? ''),
    name_ckb: String(row.name_ckb ?? ''),
    name_ar: String(row.name_ar ?? ''),
    name_en: String(row.name_en ?? ''),
    description_ckb: (row.description_ckb as string | null | undefined) ?? null,
    description_ar: (row.description_ar as string | null | undefined) ?? null,
    description_en: (row.description_en as string | null | undefined) ?? null,
    promotion_type: row.promotion_type === 'automatic' ? 'automatic' : 'coupon',
    discount_type: row.discount_type === 'fixed' ? 'fixed' : 'percentage',
    discount_value: normalizeNumber(row.discount_value),
    max_discount_iqd: row.max_discount_iqd == null ? null : normalizeNumber(row.max_discount_iqd),
    min_subtotal_iqd: normalizeNumber(row.min_subtotal_iqd),
    vendor_id: row.vendor_id ? String(row.vendor_id) : null,
    category_id: row.category_id ? String(row.category_id) : null,
    priority: Number(row.priority ?? 0),
    starts_at: String(row.starts_at ?? ''),
    ends_at: row.ends_at ? String(row.ends_at) : null,
    usage_limit: row.usage_limit == null ? null : Number(row.usage_limit),
    usage_count: Number(row.usage_count ?? 0),
    per_user_limit: Number(row.per_user_limit ?? 1),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ''),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
    coupons: Array.isArray(row.coupons) ? row.coupons.map((coupon) => {
      const c = asRecord(coupon);
      return {
        id: String(c.id ?? ''), code: String(c.code ?? ''), usage_limit: c.usage_limit == null ? null : Number(c.usage_limit),
        usage_count: Number(c.usage_count ?? 0), per_user_limit: Number(c.per_user_limit ?? 1),
        is_active: Boolean(c.is_active), created_at: String(c.created_at ?? ''),
      };
    }) : undefined,
  };
}

export async function validateCoupon(code: string): Promise<CouponValidation> {
  const { data, error } = await supabase.rpc('validate_coupon', { p_code: code.trim() });
  if (error) throw new Error(`coupon_validation_failed: ${error.message}`);
  return data as CouponValidation;
}

export async function listActivePromotions(): Promise<Promotion[]> {
  const { data, error } = await supabase.rpc('list_active_promotions');
  if (error) throw new Error(`active_promotions_load_failed: ${error.message}`);
  const items = asRecord(data).items;
  return Array.isArray(items) ? items.map(normalizePromotion) : [];
}

export async function listPromotionsAdmin(limit = 100): Promise<Promotion[]> {
  const { data, error } = await supabase.rpc('list_promotions_admin', { p_limit: limit });
  if (error) throw new Error(`promotions_admin_load_failed: ${error.message}`);
  const items = asRecord(data).items;
  return Array.isArray(items) ? items.map(normalizePromotion) : [];
}

export async function createPromotion(payload: {
  name_ckb: string;
  name_ar: string;
  name_en: string;
  promotion_type: PromotionType;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_iqd?: number | null;
  min_subtotal_iqd?: number;
  vendor_id?: string | null;
  category_id?: string | null;
  priority?: number;
  starts_at?: string;
  ends_at?: string | null;
  usage_limit?: number | null;
  per_user_limit?: number;
}): Promise<Promotion> {
  const { data, error } = await supabase.rpc('create_promotion', { p_payload: payload });
  if (error) throw new Error(`promotion_create_failed: ${error.message}`);
  return normalizePromotion(asRecord(data).item);
}

export async function createCouponCode(promotionId: string, code: string, usageLimit?: number | null, perUserLimit = 1): Promise<CouponCode> {
  const { data, error } = await supabase.rpc('create_coupon_code', {
    p_promotion_id: promotionId,
    p_code: code,
    p_usage_limit: usageLimit ?? null,
    p_per_user_limit: perUserLimit,
  });
  if (error) throw new Error(`coupon_create_failed: ${error.message}`);
  const row = asRecord(data).item;
  const item = asRecord(row);
  return {
    id: String(item.id ?? ''), code: String(item.code ?? ''), usage_limit: item.usage_limit == null ? null : Number(item.usage_limit),
    usage_count: Number(item.usage_count ?? 0), per_user_limit: Number(item.per_user_limit ?? 1),
    is_active: Boolean(item.is_active), created_at: String(item.created_at ?? ''),
  };
}

export async function setPromotionActive(promotionId: string, isActive: boolean): Promise<Promotion> {
  const { data, error } = await supabase.rpc('set_promotion_active', { p_promotion_id: promotionId, p_is_active: isActive });
  if (error) throw new Error(`promotion_toggle_failed: ${error.message}`);
  return normalizePromotion(asRecord(data).item);
}

export async function setCouponActive(couponId: string, isActive: boolean): Promise<CouponCode> {
  const { data, error } = await supabase.rpc('set_coupon_active', { p_coupon_id: couponId, p_is_active: isActive });
  if (error) throw new Error(`coupon_toggle_failed: ${error.message}`);
  const item = asRecord(asRecord(data).item);
  return {
    id: String(item.id ?? ''), code: String(item.code ?? ''), usage_limit: item.usage_limit == null ? null : Number(item.usage_limit),
    usage_count: Number(item.usage_count ?? 0), per_user_limit: Number(item.per_user_limit ?? 1),
    is_active: Boolean(item.is_active), created_at: String(item.created_at ?? ''),
  };
}
