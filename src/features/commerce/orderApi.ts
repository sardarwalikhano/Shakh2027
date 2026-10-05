import { supabase } from '../../lib/supabase';

export type PlaceOrderResult = {
  checkout_session_id: string;
  status: string;
  order_ids: string[];
  order_numbers: string[];
  total_iqd: number;
  subtotal_iqd?: number;
  discount_iqd?: number;
  coupon_code?: string | null;
};

export async function getMyAddresses() {
  const { data: userResult, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`addresses_user_load_failed: ${userError.message}`);
  if (!userResult.user) throw new Error('not_authenticated');

  const { data, error } = await supabase
    .from('addresses')
    .select('id,recipient_name,phone,city,district,street,landmark,notes,is_default')
    .eq('user_id', userResult.user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(`addresses_load_failed: ${error.message}`);
  return data ?? [];
}

export async function saveAddress(input: {
  recipientName: string;
  phone: string;
  city: string;
  district: string;
  street: string;
  landmark: string;
  notes: string;
  isDefault?: boolean;
}) {
  const { data: userResult } = await supabase.auth.getUser();
  if (!userResult.user) throw new Error('not_authenticated');

  const { data, error } = await supabase
    .from('addresses')
    .insert({
      user_id: userResult.user.id,
      recipient_name: input.recipientName.trim(),
      phone: input.phone.trim(),
      city: input.city.trim() || 'هەولێر',
      district: input.district.trim(),
      street: input.street.trim() || null,
      landmark: input.landmark.trim() || null,
      notes: input.notes.trim() || null,
      is_default: Boolean(input.isDefault),
    })
    .select('id')
    .single();

  if (error) throw new Error(`address_save_failed: ${error.message}`);
  return data.id as string;
}

export async function placeOrderFromCart(addressId: string, paymentMethod: 'cash_on_delivery' | 'wallet' | 'mobile_cash', idempotencyKey = crypto.randomUUID(), couponCode?: string) {
  if (!addressId) throw new Error('address_required');
  if (!idempotencyKey) throw new Error('idempotency_key_required');
  const { data, error } = await supabase.rpc('checkout_and_initialize_payment', {
    p_address_id: addressId,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_coupon_code: couponCode?.trim() || null,
  });

  if (error) throw new Error(`checkout_payment_failed: ${error.message}`);
  return data as PlaceOrderResult & { payment: import('./paymentApi').PaymentInitialization };
}
