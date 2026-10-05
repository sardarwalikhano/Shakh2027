import { supabase } from '../../lib/supabase';

export type PaymentIntent = {
  id: string;
  checkout_session_id: string | null;
  order_id: string | null;
  buyer_user_id: string;
  payment_method: 'cash_on_delivery' | 'wallet' | 'mobile_cash';
  provider: string;
  amount_iqd: number;
  currency: 'IQD';
  status: 'pending' | 'requires_action' | 'succeeded' | 'failed' | 'cancelled' | 'expired';
  idempotency_key: string;
  provider_payment_id: string | null;
  provider_reference: string | null;
  failure_reason: string | null;
  metadata: Record<string, unknown>;
  client_action?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type PaymentInitialization = {
  checkout_session_id: string;
  payment_method: PaymentIntent['payment_method'];
  status: PaymentIntent['status'] | 'pending';
  amount_iqd?: number;
  payment_intent_id?: string;
  provider?: string;
  balance_after_iqd?: number;
  intents?: Array<{
    payment_intent_id: string;
    order_id: string;
    status: PaymentIntent['status'];
    amount_iqd: number;
    provider: string;
  }>;
};

export async function createPaymentIntent(checkoutSessionId: string, idempotencyKey: string) {
  const { data, error } = await supabase.rpc('create_payment_intent_for_checkout', {
    p_checkout_session_id: checkoutSessionId,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`payment_intent_create_failed: ${error.message}`);
  return data as PaymentInitialization;
}

export async function checkoutAndInitializePayment(addressId: string, paymentMethod: PaymentIntent['payment_method'], idempotencyKey = crypto.randomUUID(), couponCode?: string) {
  if (!addressId) throw new Error('address_required');
  if (!idempotencyKey) throw new Error('idempotency_key_required');
  const { data, error } = await supabase.rpc('checkout_and_initialize_payment', {
    p_address_id: addressId,
    p_payment_method: paymentMethod,
    p_idempotency_key: idempotencyKey,
    p_coupon_code: couponCode?.trim() || null,
  });
  if (error) throw new Error(`checkout_payment_failed: ${error.message}`);
  return data as PaymentInitialization & { order_ids: string[]; order_numbers: string[]; total_iqd: number };
}

export async function getMyPaymentIntents(limit = 30) {
  const { data, error } = await supabase
    .from('payment_intents')
    .select('id,checkout_session_id,order_id,buyer_user_id,payment_method,provider,amount_iqd,currency,status,idempotency_key,provider_payment_id,provider_reference,failure_reason,metadata,client_action,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`payment_intents_load_failed: ${error.message}`);
  return (data ?? []) as PaymentIntent[];
}

export function subscribeToPaymentIntents(userId: string, onChange: (intent: PaymentIntent) => void) {
  return supabase
    .channel(`payment-intents-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'payment_intents', filter: `buyer_user_id=eq.${userId}`,
    }, (payload) => {
      if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) onChange(payload.new as PaymentIntent);
    })
    .subscribe();
}

export type CashCollection = {
  id: string;
  order_id: string;
  payment_intent_id: string;
  captain_user_id: string;
  amount_iqd: number;
  status: 'collected' | 'deposited' | 'reconciled' | 'disputed';
  deposit_reference: string | null;
  notes: string | null;
  collected_at: string;
  reconciled_by: string | null;
  reconciled_at: string | null;
};

export async function getCashCollections(limit = 50) {
  const { data, error } = await supabase
    .from('cash_collections')
    .select('id,order_id,payment_intent_id,captain_user_id,amount_iqd,status,deposit_reference,notes,collected_at,reconciled_by,reconciled_at')
    .order('collected_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`cash_collections_load_failed: ${error.message}`);
  return (data ?? []) as CashCollection[];
}

export async function reconcileCashCollection(collectionId: string, status: 'deposited' | 'reconciled' | 'disputed', depositReference?: string, notes?: string) {
  const { data, error } = await supabase.rpc('reconcile_cash_collection', {
    p_collection_id: collectionId,
    p_status: status,
    p_deposit_reference: depositReference ?? null,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(`cash_reconciliation_failed: ${error.message}`);
  return data as CashCollection;
}
