import { supabase } from '../../lib/supabase';

export type CarListing = {
  id: string;
  seller_user_id: string;
  title_ckb: string;
  title_ar: string;
  title_en: string;
  make: string;
  model: string;
  year: number;
  price_iqd: number;
  mileage_km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  condition: string | null;
  city: string;
  district: string | null;
  description: string | null;
  images: unknown[];
  status: 'active' | 'paused' | 'sold' | 'rejected';
  listing_fee_iqd: number;
  payment_status: 'paid';
  created_at: string;
  updated_at: string;
};

export async function listCarListings() {
  const { data, error } = await supabase.from('car_listings')
    .select('id,seller_user_id,title_ckb,title_ar,title_en,make,model,year,price_iqd,mileage_km,fuel_type,transmission,condition,city,district,description,images,status,listing_fee_iqd,payment_status,created_at,updated_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw new Error(`car_listings_load_failed: ${error.message}`);
  return (data ?? []) as unknown as CarListing[];
}

export async function createCarListing(input: Omit<CarListing, 'id' | 'seller_user_id' | 'listing_fee_iqd' | 'payment_status' | 'status' | 'created_at' | 'updated_at'> & { idempotencyKey?: string }) {
  const { data, error } = await supabase.rpc('create_car_listing', {
    p_title_ckb: input.title_ckb,
    p_title_ar: input.title_ar,
    p_title_en: input.title_en,
    p_make: input.make,
    p_model: input.model,
    p_year: input.year,
    p_price_iqd: input.price_iqd,
    p_mileage_km: input.mileage_km,
    p_fuel_type: input.fuel_type,
    p_transmission: input.transmission,
    p_condition: input.condition,
    p_city: input.city,
    p_district: input.district,
    p_description: input.description,
    p_images: input.images,
    p_idempotency_key: input.idempotencyKey ?? crypto.randomUUID(),
  });
  if (error) throw new Error(`car_listing_create_failed: ${error.message}`);
  return data as unknown as CarListing;
}

export async function getCarListingFee() {
  const { data, error } = await supabase.from('car_listing_fee_rules')
    .select('fee_iqd,effective_from,effective_to,priority')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`car_listing_fee_load_failed: ${error.message}`);
  return data ? Number(data.fee_iqd) : null;
}

export async function setCarListingFee(feeIqd: number) {
  const { data, error } = await supabase.rpc('set_car_listing_fee_rule', { p_fee_iqd: feeIqd, p_priority: 100 });
  if (error) throw new Error(`car_listing_fee_update_failed: ${error.message}`);
  return data;
}
