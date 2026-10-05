import { supabase } from '../../lib/supabase';

export type DashboardMetrics = {
  total_users: number | null;
  active_users: number | null;
  total_vendors: number | null;
  active_vendors: number | null;
  orders_today: number | null;
  orders_pending: number | null;
  orders_delivered_today: number | null;
  gross_paid_today_iqd: number | null;
  pending_payments: number | null;
  failed_payments_24h: number | null;
  active_deliveries: number | null;
  unassigned_orders: number | null;
  available_captains: number | null;
  support_open: number | null;
  support_urgent: number | null;
  pending_withdrawals: number | null;
};

export type DashboardOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_iqd: number;
  created_at: string;
};

export type DashboardEvent = {
  id: string;
  event_type: string;
  entity_type: string | null;
  entity_id: string | null;
  severity: 'info' | 'success' | 'warning' | 'error';
  title_ckb: string;
  created_at: string;
};

export type DashboardAudit = {
  id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  actor_user_id: string | null;
  created_at: string;
};

export type DashboardSupport = {
  id: string;
  ticket_number: string;
  subject: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: string;
  last_message_at: string;
};

export type OperationsSnapshot = {
  generated_at: string;
  local_timezone: string;
  metrics: DashboardMetrics;
  recent_orders: DashboardOrder[];
  recent_events: DashboardEvent[];
  recent_audit: DashboardAudit[];
  support_queue: DashboardSupport[];
};

export async function getOperationsSnapshot() {
  const { data, error } = await supabase.rpc('get_operations_dashboard_snapshot');
  if (error) throw new Error(`operations_snapshot_load_failed: ${error.message}`);
  return data as OperationsSnapshot;
}

export type AuditConsoleItem = DashboardAudit & { metadata: Record<string, unknown> };

export async function getAuditConsole(input?: { limit?: number; action?: string; entityType?: string }) {
  const { data, error } = await supabase.rpc('get_audit_console', {
    p_limit: input?.limit ?? 50,
    p_action: input?.action?.trim() || null,
    p_entity_type: input?.entityType?.trim() || null,
  });
  if (error) throw new Error(`audit_console_load_failed: ${error.message}`);
  return data as { items: AuditConsoleItem[]; limit: number; generated_at: string };
}
