import { supabase } from '../../lib/supabase';

export type SupportTicket = {
  id: string;
  ticket_number: string;
  requester_user_id: string;
  assignee_user_id: string | null;
  order_id: string | null;
  category: 'order' | 'payment' | 'delivery' | 'account' | 'vendor' | 'technical' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'pending_customer' | 'pending_support' | 'resolved' | 'closed';
  subject: string;
  last_message_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_user_id: string;
  body: string;
  internal_note: boolean;
  created_at: string;
};

export async function getSupportTickets(limit = 50) {
  const { data, error } = await supabase.from('support_tickets').select('*').order('last_message_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`support_tickets_load_failed: ${error.message}`);
  return (data ?? []) as SupportTicket[];
}

export async function getSupportMessages(ticketId: string) {
  const { data, error } = await supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
  if (error) throw new Error(`support_messages_load_failed: ${error.message}`);
  return (data ?? []) as SupportMessage[];
}

export async function createSupportTicket(input: { category: SupportTicket['category']; priority: SupportTicket['priority']; subject: string; message: string; orderId?: string | null }) {
  const { data, error } = await supabase.rpc('create_support_ticket', { p_category: input.category, p_priority: input.priority, p_subject: input.subject, p_message: input.message, p_order_id: input.orderId ?? null });
  if (error) throw new Error(`support_ticket_create_failed: ${error.message}`);
  return data as SupportTicket;
}

export async function sendSupportMessage(ticketId: string, body: string, internalNote = false) {
  const { data, error } = await supabase.rpc('send_support_message', { p_ticket_id: ticketId, p_body: body, p_internal_note: internalNote });
  if (error) throw new Error(`support_message_send_failed: ${error.message}`);
  return data as SupportMessage;
}

export async function updateSupportTicket(ticketId: string, input: { status?: SupportTicket['status']; priority?: SupportTicket['priority']; assigneeUserId?: string | null }) {
  const { data, error } = await supabase.rpc('update_support_ticket', { p_ticket_id: ticketId, p_status: input.status ?? null, p_priority: input.priority ?? null, p_assignee_user_id: input.assigneeUserId ?? null });
  if (error) throw new Error(`support_ticket_update_failed: ${error.message}`);
  return data as SupportTicket;
}

export function subscribeToSupportTicket(ticketId: string, onMessage: (message: SupportMessage) => void) {
  return supabase.channel(`support-ticket-${ticketId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` }, (payload) => {
    if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) onMessage(payload.new as SupportMessage);
  }).subscribe();
}
