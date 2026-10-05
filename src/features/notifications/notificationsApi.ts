import { supabase } from '../../lib/supabase';

export type NotificationRow = {
  id: string;
  recipient_user_id: string;
  event_id: string | null;
  notification_type: string;
  category: 'order' | 'payment' | 'delivery' | 'support' | 'security' | 'marketing' | 'system';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title_ckb: string;
  body_ckb: string | null;
  title_ar: string | null;
  body_ar: string | null;
  title_en: string | null;
  body_en: string | null;
  action_hash: string | null;
  read_at: string | null;
  created_at: string;
};

export async function getNotifications(limit = 50) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,recipient_user_id,event_id,notification_type,category,priority,title_ckb,body_ckb,title_ar,body_ar,title_en,body_en,action_hash,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`notifications_load_failed: ${error.message}`);
  return (data ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount() {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  if (error) throw new Error(`notification_count_failed: ${error.message}`);
  return count ?? 0;
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
  if (error) throw new Error(`notification_read_failed: ${error.message}`);
}

export async function markAllNotificationsRead() {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw new Error(`notifications_mark_all_failed: ${error.message}`);
}

export type NotificationPreferences = {
  order_updates: boolean;
  payment_updates: boolean;
  delivery_updates: boolean;
  support_updates: boolean;
  security_alerts: boolean;
  marketing_updates: boolean;
};

export async function getNotificationPreferences(userId: string) {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('order_updates,payment_updates,delivery_updates,support_updates,security_alerts,marketing_updates')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`notification_preferences_load_failed: ${error.message}`);
  return (data ?? {
    order_updates: true,
    payment_updates: true,
    delivery_updates: true,
    support_updates: true,
    security_alerts: true,
    marketing_updates: false,
  }) as NotificationPreferences;
}

export async function updateNotificationPreferences(preferences: NotificationPreferences) {
  const { data, error } = await supabase.rpc('update_notification_preferences', {
    p_order_updates: preferences.order_updates,
    p_payment_updates: preferences.payment_updates,
    p_delivery_updates: preferences.delivery_updates,
    p_support_updates: preferences.support_updates,
    p_security_alerts: preferences.security_alerts,
    p_marketing_updates: preferences.marketing_updates,
  });
  if (error) throw new Error(`notification_preferences_update_failed: ${error.message}`);
  return data as NotificationPreferences & { user_id: string };
}

export function subscribeToNotifications(userId: string, onChange: (row: NotificationRow) => void) {
  return supabase
    .channel(`notifications-${userId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${userId}`,
    }, (payload) => {
      if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) onChange(payload.new as NotificationRow);
    })
    .subscribe();
}
