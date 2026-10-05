import { supabase } from '../../lib/supabase';

export type UmrahPackage = {
  id: string;
  agency_vendor_id: string;
  title_ckb: string;
  title_ar: string;
  title_en: string;
  description_ckb: string | null;
  description_ar: string | null;
  description_en: string | null;
  departure_date: string | null;
  return_date: string | null;
  duration_days: number | null;
  hotel_name: string | null;
  transport_details: string | null;
  package_price_iqd: number | null;
  city: string;
  status: 'draft' | 'active' | 'paused' | 'expired';
  capacity: number | null;
  seats_booked: number;
  created_at: string;
  updated_at: string;
};

export type UmrahBooking = {
  id: string;
  package_id: string;
  booking_fee_iqd: number;
  status: 'requested' | 'confirmed' | 'cancelled' | 'completed';
  payment_status: 'paid';
  participant_count: number;
  contact_name: string;
  contact_phone: string;
  notes: string | null;
  booked_at: string;
};

export async function listUmrahPackages() {
  const { data, error } = await supabase.from('umrah_packages')
    .select('id,agency_vendor_id,title_ckb,title_ar,title_en,description_ckb,description_ar,description_en,departure_date,return_date,duration_days,hotel_name,transport_details,package_price_iqd,city,status,capacity,seats_booked,created_at,updated_at')
    .eq('status', 'active')
    .order('departure_date', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(`umrah_packages_load_failed: ${error.message}`);
  return (data ?? []) as unknown as UmrahPackage[];
}

export async function getUmrahBookingFee() {
  const { data, error } = await supabase.from('umrah_booking_fee_rules')
    .select('fee_iqd,effective_from,effective_to,priority')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`umrah_booking_fee_load_failed: ${error.message}`);
  return data ? Number(data.fee_iqd) : 2000;
}

export async function createUmrahBooking(input: { packageId: string; participantCount: number; contactName: string; contactPhone: string; notes?: string }) {
  const { data, error } = await supabase.rpc('create_umrah_booking', {
    p_package_id: input.packageId,
    p_participant_count: input.participantCount,
    p_contact_name: input.contactName,
    p_contact_phone: input.contactPhone,
    p_notes: input.notes ?? null,
    p_idempotency_key: crypto.randomUUID(),
  });
  if (error) throw new Error(`umrah_booking_create_failed: ${error.message}`);
  return data as unknown as UmrahBooking;
}

export async function createUmrahPackage(input: {
  titleCkb: string; titleAr: string; titleEn: string; departureDate?: string; returnDate?: string; durationDays?: number;
  hotelName?: string; transportDetails?: string; packagePriceIqd?: number; city?: string; capacity?: number; descriptionCkb?: string;
}) {
  const { data, error } = await supabase.rpc('create_umrah_package', {
    p_title_ckb: input.titleCkb, p_title_ar: input.titleAr, p_title_en: input.titleEn,
    p_description_ckb: input.descriptionCkb ?? null, p_departure_date: input.departureDate ?? null,
    p_return_date: input.returnDate ?? null, p_duration_days: input.durationDays ?? null,
    p_hotel_name: input.hotelName ?? null, p_transport_details: input.transportDetails ?? null,
    p_package_price_iqd: input.packagePriceIqd ?? null, p_city: input.city ?? 'هەولێر', p_capacity: input.capacity ?? null,
  });
  if (error) throw new Error(`umrah_package_create_failed: ${error.message}`);
  return data as unknown as UmrahPackage;
}
