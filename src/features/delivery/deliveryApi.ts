import { supabase } from '../../lib/supabase';

export type CaptainProfile = {
  user_id: string;
  captain_code: string;
  status: 'offline' | 'available' | 'busy' | 'suspended';
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  is_verified: boolean;
  joined_at: string;
  updated_at: string;
};

export type DeliveryAssignment = {
  id: string;
  order_id: string;
  captain_user_id: string | null;
  status:
    | 'unassigned'
    | 'assigned'
    | 'accepted'
    | 'at_pickup'
    | 'picked_up'
    | 'out_for_delivery'
    | 'delivered'
    | 'failed'
    | 'cancelled';
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  dropoff_latitude: number | null;
  dropoff_longitude: number | null;
  estimated_minutes: number | null;
  delivery_fee_iqd: number;
  captain_earning_iqd: number;
  assigned_at: string | null;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  failure_reason: string | null;
};

export type DeliveryTracking = {
  assignment_id: string;
  order_id: string;
  status: DeliveryAssignment['status'];
  estimated_minutes: number | null;
  delivery_fee_iqd: number;
  pickup: { latitude: number; longitude: number } | null;
  dropoff: { latitude: number; longitude: number } | null;
  captain: {
    captain_code: string;
    vehicle_type: string | null;
    vehicle_make: string | null;
    vehicle_model: string | null;
  } | null;
  location: {
    latitude: number;
    longitude: number;
    heading: number | null;
    speed_kmh: number | null;
    accuracy_m: number | null;
    recorded_at: string;
  } | null;
};

export async function getCaptainProfile(userId: string) {
  const { data, error } = await supabase
    .from('captain_profiles')
    .select('user_id,captain_code,status,vehicle_type,vehicle_make,vehicle_model,vehicle_plate,is_verified,joined_at,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`captain_profile_load_failed: ${error.message}`);
  return (data ?? null) as CaptainProfile | null;
}

export async function setCaptainAvailability(status: 'offline' | 'available') {
  const { data, error } = await supabase.rpc('set_captain_availability', { p_status: status });
  if (error) throw new Error(`captain_availability_failed: ${error.message}`);
  return data as CaptainProfile;
}

export async function getCaptainAssignments(userId: string) {
  const { data, error } = await supabase
    .from('delivery_assignments')
    .select('id,order_id,captain_user_id,status,pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,estimated_minutes,delivery_fee_iqd,captain_earning_iqd,assigned_at,accepted_at,picked_up_at,delivered_at,failure_reason')
    .eq('captain_user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(`captain_assignments_load_failed: ${error.message}`);
  return (data ?? []) as DeliveryAssignment[];
}

export async function respondToAssignment(assignmentId: string, accept: boolean, note?: string) {
  const { data, error } = await supabase.rpc('respond_to_delivery_assignment', {
    p_assignment_id: assignmentId,
    p_accept: accept,
    p_note: note ?? null,
  });
  if (error) throw new Error(`assignment_response_failed: ${error.message}`);
  return data as DeliveryAssignment;
}

export async function updateDeliveryStatus(
  assignmentId: string,
  status: Exclude<DeliveryAssignment['status'], 'unassigned' | 'assigned' | 'accepted'>,
  note?: string,
) {
  const { data, error } = await supabase.rpc('update_delivery_status', {
    p_assignment_id: assignmentId,
    p_next_status: status,
    p_note: note ?? null,
  });
  if (error) throw new Error(`delivery_status_update_failed: ${error.message}`);
  return data as DeliveryAssignment;
}

export async function recordCaptainLocation(
  assignmentId: string | null,
  position: GeolocationPosition,
) {
  const { data, error } = await supabase.rpc('record_captain_location', {
    p_latitude: position.coords.latitude,
    p_longitude: position.coords.longitude,
    p_heading: position.coords.heading,
    p_speed_kmh: position.coords.speed == null ? null : position.coords.speed * 3.6,
    p_accuracy_m: position.coords.accuracy,
    p_assignment_id: assignmentId,
  });
  if (error) throw new Error(`captain_location_update_failed: ${error.message}`);
  return data;
}

export async function getDeliveryTracking(orderId: string) {
  const { data, error } = await supabase.rpc('get_delivery_tracking', { p_order_id: orderId });
  if (error) throw new Error(`delivery_tracking_load_failed: ${error.message}`);
  return data as DeliveryTracking;
}

export type DispatchOrder = {
  id: string;
  order_number: string;
  vendor_id: string;
  buyer_user_id: string;
  status: string;
  total_iqd: number;
  created_at: string;
};

export async function getDispatchOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('id,order_number,vendor_id,buyer_user_id,status,total_iqd,created_at')
    .in('status', ['placed', 'confirmed', 'processing'])
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw new Error(`dispatch_orders_load_failed: ${error.message}`);
  return (data ?? []) as DispatchOrder[];
}

export async function getAvailableCaptains() {
  const { data, error } = await supabase
    .from('captain_profiles')
    .select('user_id,captain_code,status,vehicle_type,vehicle_make,vehicle_model,vehicle_plate,is_verified,joined_at,updated_at')
    .eq('status', 'available')
    .eq('is_verified', true)
    .order('updated_at', { ascending: true })
    .limit(100);
  if (error) throw new Error(`available_captains_load_failed: ${error.message}`);
  return (data ?? []) as CaptainProfile[];
}

export async function assignCaptainToOrder(orderId: string, captainUserId: string, deliveryFeeIqd = 0, estimatedMinutes?: number) {
  const { data, error } = await supabase.rpc('assign_captain_to_order', {
    p_order_id: orderId,
    p_captain_user_id: captainUserId,
    p_delivery_fee_iqd: deliveryFeeIqd,
    p_estimated_minutes: estimatedMinutes ?? null,
    p_notes: null,
  });
  if (error) throw new Error(`captain_assignment_failed: ${error.message}`);
  return data as DeliveryAssignment;
}

export type DispatchBoardLocation = {
  latitude: number;
  longitude: number;
  heading: number | null;
  speed_kmh: number | null;
  accuracy_m: number | null;
  recorded_at: string;
  age_seconds?: number;
};

export type DispatchBoardAssignment = {
  id: string | null;
  status: DeliveryAssignment['status'] | null;
  captain_user_id: string | null;
  captain_code: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  assigned_at: string | null;
  accepted_at: string | null;
  estimated_minutes: number | null;
  delivery_fee_iqd: number | null;
  captain_earning_iqd: number | null;
  pickup: { latitude: number; longitude: number } | null;
  dropoff: { latitude: number; longitude: number } | null;
  last_location: DispatchBoardLocation | null;
};

export type DispatchBoardOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_iqd: number;
  delivery_fee_iqd: number;
  created_at: string;
  buyer_name: string;
  buyer_phone: string;
  shipping_city: string;
  shipping_district: string;
  shipping_street: string | null;
  shipping_landmark: string | null;
  shipping_notes: string | null;
  vendor_name: string;
  dispatch_priority: number;
  assignment: DispatchBoardAssignment;
};

export type DispatchBoardCaptain = {
  user_id: string;
  captain_code: string;
  status: CaptainProfile['status'];
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  is_verified: boolean;
  joined_at: string;
  updated_at: string;
  active_assignment_id: string | null;
  active_assignment_status: DeliveryAssignment['status'] | null;
  active_order_number: string | null;
  last_location: DispatchBoardLocation | null;
};

export type DispatchBoard = {
  generated_at: string;
  metrics: {
    unassigned_orders: number;
    assigned_orders: number;
    active_deliveries: number;
    queued_orders: number;
    available_captains: number;
    busy_captains: number;
    offline_captains: number;
    suspended_captains: number;
    stale_active_captains: number;
  };
  orders: DispatchBoardOrder[];
  captains: DispatchBoardCaptain[];
};

export async function getDispatchBoard(limit = 80) {
  const { data, error } = await supabase.rpc('get_dispatch_board', { p_limit: limit });
  if (error) throw new Error(`dispatch_board_load_failed: ${error.message}`);
  const board = data as Partial<DispatchBoard> | null;
  return {
    generated_at: String(board?.generated_at ?? new Date().toISOString()),
    metrics: {
      unassigned_orders: Number(board?.metrics?.unassigned_orders ?? 0),
      assigned_orders: Number(board?.metrics?.assigned_orders ?? 0),
      active_deliveries: Number(board?.metrics?.active_deliveries ?? 0),
      queued_orders: Number(board?.metrics?.queued_orders ?? 0),
      available_captains: Number(board?.metrics?.available_captains ?? 0),
      busy_captains: Number(board?.metrics?.busy_captains ?? 0),
      offline_captains: Number(board?.metrics?.offline_captains ?? 0),
      suspended_captains: Number(board?.metrics?.suspended_captains ?? 0),
      stale_active_captains: Number(board?.metrics?.stale_active_captains ?? 0),
    },
    orders: (board?.orders ?? []) as DispatchBoardOrder[],
    captains: (board?.captains ?? []) as DispatchBoardCaptain[],
  } satisfies DispatchBoard;
}


export type CaptainMobileLocation = DispatchBoardLocation;

export type CaptainMobileSla = {
  sla_state: 'on_track' | 'at_risk' | 'overdue' | 'not_available';
  deadline: string | null;
  remaining_minutes: number | null;
  age_minutes: number;
  next_action: string;
};

export type CaptainMobileSnapshot = {
  captain: (Omit<CaptainProfile, 'joined_at'> & { last_location: CaptainMobileLocation | null }) | null;
  active_assignment: {
    assignment_id: string;
    order_id: string;
    order_number: string;
    status: DeliveryAssignment['status'];
    estimated_minutes: number | null;
    delivery_fee_iqd: number;
    captain_earning_iqd: number;
    assigned_at: string | null;
    accepted_at: string | null;
    picked_up_at: string | null;
    buyer_name: string;
    buyer_phone: string;
    shipping_city: string;
    shipping_district: string;
    shipping_street: string | null;
    shipping_landmark: string | null;
    shipping_notes: string | null;
    vendor_name: string;
    vendor_latitude: number | null;
    vendor_longitude: number | null;
    pickup: { latitude: number; longitude: number } | null;
    dropoff: { latitude: number; longitude: number } | null;
    last_location: DispatchBoardLocation | null;
    sla: CaptainMobileSla;
  } | null;
  pending_assignments: Array<{
    assignment_id: string;
    order_id: string;
    order_number: string;
    status: 'assigned';
    estimated_minutes: number | null;
    assigned_at: string | null;
    vendor_name: string;
    shipping_city: string;
    shipping_district: string;
    shipping_street: string | null;
    sla: CaptainMobileSla;
  }>;
  recent_assignments: Array<{
    assignment_id: string;
    order_id: string;
    order_number: string;
    status: DeliveryAssignment['status'];
    estimated_minutes: number | null;
    delivery_fee_iqd: number;
    captain_earning_iqd: number;
    updated_at: string;
  }>;
};

export type DispatchCaptainRecommendation = {
  user_id: string;
  captain_code: string;
  status: CaptainProfile['status'];
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  recorded_at: string | null;
  distance_to_pickup_km: number | null;
  location_age_seconds: number | null;
};

export async function getCaptainMobileSnapshot(userId?: string) {
  const { data, error } = await supabase.rpc('get_captain_mobile_snapshot', { p_captain_user_id: userId ?? null });
  if (error) throw new Error(`captain_mobile_snapshot_failed: ${error.message}`);
  return (data ?? { captain: null, active_assignment: null, pending_assignments: [], recent_assignments: [] }) as CaptainMobileSnapshot;
}

export async function getDispatchCaptainRecommendations(orderId: string, limit = 8) {
  const { data, error } = await supabase.rpc('get_dispatch_captain_recommendations', { p_order_id: orderId, p_limit: limit });
  if (error) throw new Error(`dispatch_captain_recommendations_failed: ${error.message}`);
  return (data ?? []) as DispatchCaptainRecommendation[];
}

export async function releaseDeliveryAssignment(assignmentId: string, note?: string) {
  const { data, error } = await supabase.rpc('release_delivery_assignment', {
    p_assignment_id: assignmentId,
    p_note: note ?? null,
  });
  if (error) throw new Error(`delivery_assignment_release_failed: ${error.message}`);
  return data as DeliveryAssignment;
}

export async function reassignDeliveryAssignment(assignmentId: string, captainUserId: string, note?: string) {
  const { data, error } = await supabase.rpc('reassign_delivery_assignment', {
    p_assignment_id: assignmentId,
    p_new_captain_user_id: captainUserId,
    p_notes: note ?? null,
  });
  if (error) throw new Error(`delivery_assignment_reassign_failed: ${error.message}`);
  return data as DeliveryAssignment;
}
