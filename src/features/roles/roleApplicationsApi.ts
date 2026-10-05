import { supabase } from '../../lib/supabase';

export type RoleApplication = {
  id: string;
  applicant_user_id: string;
  requested_role: string;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  note: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  requested_at: string;
  reviewed_at: string | null;
};

export async function listRoleApplications(status?: string) {
  const { data, error } = await supabase.rpc('list_role_applications', { p_status: status ?? null });
  if (error) throw new Error(`role_applications_load_failed: ${error.message}`);
  return (data ?? []) as RoleApplication[];
}

export async function createRoleApplication(role: string, note?: string) {
  const { data, error } = await supabase.rpc('create_role_application', { p_requested_role: role, p_note: note ?? null });
  if (error) throw new Error(`role_application_create_failed: ${error.message}`);
  return data as RoleApplication;
}

export async function reviewRoleApplication(applicationId: string, status: 'approved' | 'rejected' | 'cancelled', reviewNote?: string) {
  const { data, error } = await supabase.rpc('review_role_application', { p_application_id: applicationId, p_status: status, p_review_note: reviewNote ?? null });
  if (error) throw new Error(`role_application_review_failed: ${error.message}`);
  return data as RoleApplication;
}
