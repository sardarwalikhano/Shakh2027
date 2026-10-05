import { supabase } from '../../lib/supabase';

export type AnalyticsOverview = {
  days: number;
  since: string;
  generated_at: string;
  events: number;
  unique_users: number;
  product_views: number;
  add_to_cart: number;
  checkout_started: number;
  order_created: number;
  order_delivered: number;
  payment_succeeded: number;
  coupon_redeemed: number;
  paid_revenue_iqd: number;
  top_events: Array<{ event_name: string; count: number }>;
  conversion: {
    view_to_cart_pct: number;
    cart_to_checkout_pct: number;
    checkout_to_order_pct: number;
    order_to_paid_pct: number;
  };
};

export async function recordAnalyticsEvent(input: {
  eventName: string;
  entityType?: string | null;
  entityId?: string | null;
  pagePath?: string | null;
  properties?: Record<string, unknown>;
  sessionId?: string | null;
}) {
  const { data, error } = await supabase.rpc('record_analytics_event', {
    p_event_name: input.eventName,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_page_path: input.pagePath ?? (window.location.pathname + window.location.hash),
    p_properties: input.properties ?? {},
    p_session_id: input.sessionId ?? null,
  });
  if (error) throw new Error(`analytics_event_failed: ${error.message}`);
  return String(data);
}

export async function getAnalyticsOverview(days = 30): Promise<AnalyticsOverview> {
  const { data, error } = await supabase.rpc('get_analytics_overview', { p_days: days });
  if (error) throw new Error(`analytics_overview_failed: ${error.message}`);
  return data as AnalyticsOverview;
}
