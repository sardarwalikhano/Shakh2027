import { supabase } from '../../lib/supabase';

export type ManagedOrderSummary = {
  id: string;
  order_number: string;
  buyer_user_id?: string;
  vendor_id: string;
  payment_method: string;
  payment_status: string;
  status: string;
  currency?: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  discount_iqd: number;
  total_iqd: number;
  shipping_recipient_name?: string;
  shipping_phone?: string;
  shipping_city?: string;
  shipping_district?: string;
  shipping_street?: string;
  shipping_landmark?: string;
  created_at: string;
  updated_at: string;
  buyer_name?: string;
  vendor_name_ckb?: string | null;
  vendor_name_ar?: string | null;
  vendor_name_en?: string | null;
  logo_url?: string | null;
  item_count: number;
  total_items: number;
  delivery_status?: string | null;
  delivery?: {
    status: string;
    captain_user_id: string | null;
    estimated_minutes: number | null;
    assigned_at: string | null;
    accepted_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
  } | null;
};

export type OrderDetail = {
  order: {
    id: string;
    order_number: string;
    checkout_session_id: string;
    buyer_user_id: string;
    vendor_id: string;
    payment_method: string;
    payment_status: string;
    status: string;
    currency: string;
    subtotal_iqd: number;
    delivery_fee_iqd: number;
    discount_iqd: number;
    total_iqd: number;
    shipping_recipient_name: string;
    shipping_phone: string;
    shipping_city: string;
    shipping_district: string;
    shipping_street: string;
    shipping_landmark: string | null;
    shipping_notes: string | null;
    promotion_id: string | null;
    coupon_id: string | null;
    coupon_code: string | null;
    created_at: string;
    updated_at: string;
  };
  items: Array<{
    id: string;
    product_id: string;
    variant_id: string;
    vendor_id: string;
    sku: string | null;
    product_name_ckb: string;
    product_name_ar: string;
    product_name_en: string;
    variant_label_ckb: string;
    variant_label_ar: string;
    variant_label_en: string;
    image_storage_path: string | null;
    unit_price_iqd: number;
    quantity: number;
    line_total_iqd: number;
    created_at: string;
  }>;
  status_history: Array<{
    id: string;
    order_id: string;
    status: string;
    actor_user_id: string | null;
    note: string | null;
    created_at: string;
  }>;
  delivery: {
    assignment_id: string;
    captain_user_id: string | null;
    status: string;
    delivery_fee_iqd: number;
    estimated_minutes: number | null;
    assigned_at: string | null;
    accepted_at: string | null;
    picked_up_at: string | null;
    delivered_at: string | null;
    failure_reason: string | null;
    updated_at: string;
    captain: {
      captain_code: string;
      vehicle_type: string;
      vehicle_make: string | null;
      vehicle_model: string | null;
      status: string;
    } | null;
  } | null;
  payment: {
    method: string;
    status: string;
    provider: string;
    amount_iqd: number;
    provider_reference: string | null;
    created_at: string;
  } | null;
};

function normalizeDetail(data: unknown): OrderDetail {
  const raw = data as OrderDetail;
  return {
    ...raw,
    order: {
      ...raw.order,
      subtotal_iqd: Number(raw.order.subtotal_iqd),
      delivery_fee_iqd: Number(raw.order.delivery_fee_iqd),
      discount_iqd: Number(raw.order.discount_iqd),
      total_iqd: Number(raw.order.total_iqd),
    },
    items: (raw.items ?? []).map((item) => ({
      ...item,
      unit_price_iqd: Number(item.unit_price_iqd),
      quantity: Number(item.quantity),
      line_total_iqd: Number(item.line_total_iqd),
    })),
    payment: raw.payment ? { ...raw.payment, amount_iqd: Number(raw.payment.amount_iqd) } : null,
  };
}

export async function listCustomerOrders(status?: string | null, limit = 50): Promise<ManagedOrderSummary[]> {
  const { data, error } = await supabase.rpc('list_customer_orders', {
    p_status: status ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(`customer_orders_load_failed: ${error.message}`);
  return (((data as { items?: ManagedOrderSummary[] } | null)?.items ?? []) as ManagedOrderSummary[]).map((row) => ({
    ...row,
    subtotal_iqd: Number(row.subtotal_iqd),
    delivery_fee_iqd: Number(row.delivery_fee_iqd),
    discount_iqd: Number(row.discount_iqd),
    total_iqd: Number(row.total_iqd),
    item_count: Number(row.item_count),
    total_items: Number(row.total_items),
  }));
}

export async function getOrderDetails(orderId: string): Promise<OrderDetail> {
  const { data, error } = await supabase.rpc('get_order_details', { p_order_id: orderId });
  if (error) throw new Error(`order_details_load_failed: ${error.message}`);
  return normalizeDetail(data);
}

export async function listVendorOrders(vendorId: string, status?: string | null, limit = 100): Promise<ManagedOrderSummary[]> {
  const { data, error } = await supabase.rpc('list_vendor_orders', {
    p_vendor_id: vendorId,
    p_status: status ?? null,
    p_limit: limit,
  });
  if (error) throw new Error(`vendor_orders_load_failed: ${error.message}`);
  return (((data as { items?: ManagedOrderSummary[] } | null)?.items ?? []) as ManagedOrderSummary[]).map((row) => ({
    ...row,
    subtotal_iqd: Number(row.subtotal_iqd),
    delivery_fee_iqd: Number(row.delivery_fee_iqd),
    discount_iqd: Number(row.discount_iqd),
    total_iqd: Number(row.total_iqd),
    item_count: Number(row.item_count),
    total_items: Number(row.total_items),
  }));
}

export async function updateVendorOrderStatus(orderId: string, nextStatus: 'confirmed' | 'processing' | 'ready_for_pickup' | 'cancelled', note?: string) {
  const { data, error } = await supabase.rpc('update_vendor_order_status', {
    p_order_id: orderId,
    p_next_status: nextStatus,
    p_note: note?.trim() || null,
  });
  if (error) throw new Error(`vendor_order_status_failed: ${error.message}`);
  return data as { order_id: string; order_number: string; status: string };
}
