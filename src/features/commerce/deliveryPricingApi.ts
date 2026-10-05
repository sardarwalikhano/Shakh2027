import { supabase } from '../../lib/supabase';

export type DeliveryZone = {
  id: string;
  code: string;
  name_ckb: string;
  name_ar: string;
  name_en: string;
  city: string;
  district: string | null;
  center_latitude: number | null;
  center_longitude: number | null;
  radius_km: number;
  priority: number;
  base_fee_iqd: number;
  included_km: number;
  per_km_fee_iqd: number;
  min_fee_iqd: number;
  max_fee_iqd: number | null;
  surge_multiplier: number;
  free_delivery_threshold_iqd: number | null;
  estimated_base_minutes: number;
  estimated_per_km_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DispatchRule = {
  id: string;
  name_ckb: string;
  name_en: string;
  priority: number;
  vehicle_type: string | null;
  max_pickup_distance_km: number | null;
  max_location_age_seconds: number;
  min_sla_remaining_minutes: number | null;
  require_gps: boolean;
  allow_no_gps: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DeliveryQuote = {
  address_id: string;
  city: string;
  district: string;
  subtotal_iqd: number;
  delivery_fee_iqd: number;
  configured: boolean;
  serviceable: boolean;
  quotes: Array<{
    status: 'quoted' | 'unconfigured' | 'outside_zone';
    zone_id: string | null;
    zone_code: string | null;
    zone_name_ckb: string | null;
    distance_km: number | null;
    fee_iqd: number;
    estimated_minutes: number | null;
    match_method: string;
    vendor_id: string;
    vendor_name: string;
    subtotal_iqd: number;
  }>;
};

export async function getCartDeliveryQuote(addressId: string) {
  const { data, error } = await supabase.rpc('get_cart_delivery_quote', { p_address_id: addressId });
  if (error) throw new Error(`delivery_quote_failed: ${error.message}`);
  const value = data as Partial<DeliveryQuote> | null;
  return {
    address_id: String(value?.address_id ?? addressId),
    city: String(value?.city ?? ''),
    district: String(value?.district ?? ''),
    subtotal_iqd: Number(value?.subtotal_iqd ?? 0),
    delivery_fee_iqd: Number(value?.delivery_fee_iqd ?? 0),
    configured: Boolean(value?.configured),
    serviceable: value?.serviceable !== false,
    quotes: Array.isArray(value?.quotes) ? value!.quotes as DeliveryQuote['quotes'] : [],
  } satisfies DeliveryQuote;
}

export async function getDeliveryPricingAdmin() {
  const { data, error } = await supabase.rpc('get_delivery_pricing_admin');
  if (error) throw new Error(`delivery_pricing_admin_failed: ${error.message}`);
  const value = data as { zones?: DeliveryZone[]; rules?: DispatchRule[] } | null;
  return { zones: value?.zones ?? [], rules: value?.rules ?? [] };
}

export async function createDeliveryZone(input: Omit<DeliveryZone, 'id'|'created_at'|'updated_at'>) {
  const { data, error } = await supabase.from('delivery_zones').insert(input).select('*').single();
  if (error) throw new Error(`delivery_zone_create_failed: ${error.message}`);
  return data as DeliveryZone;
}

export async function updateDeliveryZone(id: string, patch: Partial<Omit<DeliveryZone, 'id'|'created_at'|'updated_at'>>) {
  const { data, error } = await supabase.from('delivery_zones').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(`delivery_zone_update_failed: ${error.message}`);
  return data as DeliveryZone;
}

export async function createDispatchRule(input: Omit<DispatchRule, 'id'|'created_at'|'updated_at'>) {
  const { data, error } = await supabase.from('dispatch_rules').insert(input).select('*').single();
  if (error) throw new Error(`dispatch_rule_create_failed: ${error.message}`);
  return data as DispatchRule;
}

export async function updateDispatchRule(id: string, patch: Partial<Omit<DispatchRule, 'id'|'created_at'|'updated_at'>>) {
  const { data, error } = await supabase.from('dispatch_rules').update(patch).eq('id', id).select('*').single();
  if (error) throw new Error(`dispatch_rule_update_failed: ${error.message}`);
  return data as DispatchRule;
}

export function formatIqd(value: number) {
  return `${new Intl.NumberFormat('ku-IQ', { maximumFractionDigits: 0 }).format(value)} د.ع`;
}
