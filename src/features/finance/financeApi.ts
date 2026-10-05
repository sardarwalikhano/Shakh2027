import { supabase } from '../../lib/supabase';

export type Wallet = {
  id: string;
  wallet_type: 'customer' | 'vendor' | 'captain' | 'platform';
  owner_user_id: string | null;
  owner_vendor_id: string | null;
  currency: 'IQD';
  balance_iqd: number;
  status: 'active' | 'frozen' | 'closed';
  created_at: string;
  updated_at: string;
};

export type LedgerEntry = {
  id: string;
  wallet_id: string;
  direction: 'credit' | 'debit';
  entry_type: string;
  amount_iqd: number;
  balance_before_iqd: number;
  balance_after_iqd: number;
  reference_type: string | null;
  reference_id: string | null;
  idempotency_key: string;
  description: string | null;
  created_at: string;
};

export type Withdrawal = {
  id: string;
  wallet_id: string;
  amount_iqd: number;
  status: 'requested' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed' | 'cancelled';
  reason: string | null;
  requested_at: string;
};

export type FinanceSummary = {
  gross_iqd: number;
  commission_iqd: number;
  vendor_net_iqd: number;
  refunded_iqd: number;
  pending_withdrawals_iqd: number;
  paid_payouts_iqd: number;
  active_wallets: number;
};

export async function getAccessibleWallets() {
  const { data, error } = await supabase
    .from('wallets')
    .select('id,wallet_type,owner_user_id,owner_vendor_id,currency,balance_iqd,status,created_at,updated_at')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`wallets_load_failed: ${error.message}`);
  return (data ?? []) as Wallet[];
}

export async function getWalletLedger(walletId: string) {
  const { data, error } = await supabase
    .from('wallet_ledger_entries')
    .select('id,wallet_id,direction,entry_type,amount_iqd,balance_before_iqd,balance_after_iqd,reference_type,reference_id,idempotency_key,description,created_at')
    .eq('wallet_id', walletId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(`wallet_ledger_load_failed: ${error.message}`);
  return (data ?? []) as LedgerEntry[];
}

export async function getMyWithdrawals() {
  const { data, error } = await supabase
    .from('withdrawals')
    .select('id,wallet_id,amount_iqd,status,reason,requested_at')
    .order('requested_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`withdrawals_load_failed: ${error.message}`);
  return (data ?? []) as Withdrawal[];
}

export async function requestWithdrawal(walletId: string, amountIqd: number, idempotencyKey: string) {
  if (!walletId || amountIqd <= 0) throw new Error('invalid_withdrawal_input');
  const { data, error } = await supabase.rpc('request_withdrawal', {
    p_wallet_id: walletId,
    p_amount_iqd: amountIqd,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(`withdrawal_request_failed: ${error.message}`);
  return data;
}

export async function getFinanceSummary() {
  const { data, error } = await supabase.rpc('get_finance_summary');
  if (error) throw new Error(`finance_summary_failed: ${error.message}`);
  return data as FinanceSummary;
}


export type CaptainFinanceSnapshot = {
  wallet: Wallet | null;
  earnings: { lifetime_iqd: number; last_30_days_iqd: number; deliveries: number };
  cash_collection: { collected_iqd: number; reconciled_iqd: number; outstanding_iqd: number };
  recent_earnings: Array<{
    id: string; order_id: string; order_number: string; assignment_id: string;
    delivery_fee_iqd: number; earning_iqd: number; status: string; settled_at: string | null; created_at: string;
  }>;
};

export type FinancialDisputeType =
  | 'chargeback'
  | 'payment_dispute'
  | 'refund_dispute'
  | 'cash_dispute'
  | 'payout_dispute'
  | 'order_dispute'
  | 'other';

export type FinancialDisputeStatus = 'open' | 'in_review' | 'accepted' | 'rejected' | 'resolved' | 'cancelled';

export type FinancialDispute = {
  id: string;
  dispute_type: FinancialDisputeType;
  status: FinancialDisputeStatus;
  order_id: string | null;
  payment_intent_id: string | null;
  payment_transaction_id: string | null;
  refund_id: string | null;
  cash_collection_id: string | null;
  withdrawal_id: string | null;
  payout_id: string | null;
  amount_iqd: number;
  currency: 'IQD';
  reason: string;
  evidence: Record<string, unknown>;
  provider: string | null;
  provider_case_id: string | null;
  provider_reference: string | null;
  resolution: string | null;
  reported_by: string;
  assigned_to: string | null;
  resolved_by: string | null;
  idempotency_key: string;
  opened_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FinanceReconciliationSnapshot = {
  captain: { earned_iqd: number; ledger_credited_iqd: number; unlinked_earnings_iqd: number; settled_deliveries: number };
  cash: { collected_iqd: number; deposited_iqd: number; reconciled_iqd: number; disputed_iqd: number };
  payouts: { pending_iqd: number; paid_iqd: number; failed_iqd: number };
  withdrawals: { requested_iqd: number; approved_iqd: number; failed_iqd: number };
  disputes: { open_count: number; in_review_count: number; accepted_iqd: number; rejected_iqd: number };
  anomalies: Array<{ code: string; severity: string; entity_id: string; order_id: string | null; observed_iqd: number; expected_iqd: number; message: string }>;
  recent_captain_earnings: Array<{ id: string; order_id: string; order_number: string; captain_user_id: string; captain_code: string; delivery_fee_iqd: number; earning_iqd: number; ledger_entry_id: string | null; status: string; settled_at: string; created_at: string }>;
  outstanding_cash_collections: Array<{ id: string; order_id: string; order_number: string; captain_user_id: string; captain_code: string; amount_iqd: number; status: string; collected_at: string; deposit_reference: string | null; notes: string | null }>;
};

export async function getCaptainFinanceSnapshot(captainUserId?: string) {
  const { data, error } = await supabase.rpc('get_captain_finance_snapshot', { p_captain_user_id: captainUserId ?? null });
  if (error) throw new Error(`captain_finance_snapshot_failed: ${error.message}`);
  return data as CaptainFinanceSnapshot;
}

export async function getFinanceReconciliationSnapshot() {
  const { data, error } = await supabase.rpc('get_finance_reconciliation_snapshot');
  if (error) throw new Error(`finance_reconciliation_failed: ${error.message}`);
  return data as FinanceReconciliationSnapshot;
}

export async function reconcileCashCollection(collectionId: string, status: 'deposited' | 'reconciled' | 'disputed', depositReference?: string, notes?: string) {
  const { data, error } = await supabase.rpc('reconcile_cash_collection', {
    p_collection_id: collectionId, p_status: status, p_deposit_reference: depositReference ?? null, p_notes: notes ?? null,
  });
  if (error) throw new Error(`cash_reconciliation_failed: ${error.message}`);
  return data;
}

export type CaptainEarningRule = {
  id: string; vendor_type: string | null; rate_bps: number; fixed_fee_iqd: number; min_earning_iqd: number;
  max_earning_iqd: number | null; effective_from: string; effective_to: string | null; priority: number; is_active: boolean;
};

export async function getCaptainEarningRules() {
  const { data, error } = await supabase.from('captain_earning_rules').select('id,vendor_type,rate_bps,fixed_fee_iqd,min_earning_iqd,max_earning_iqd,effective_from,effective_to,priority,is_active').order('priority',{ascending:false}).order('effective_from',{ascending:false}).limit(50);
  if (error) throw new Error(`captain_earning_rules_load_failed: ${error.message}`);
  return (data ?? []) as CaptainEarningRule[];
}

export async function createCaptainEarningRule(input: Omit<CaptainEarningRule,'id'|'created_at'|'updated_at'>) {
  const { data, error } = await supabase.from('captain_earning_rules').insert(input).select('id,vendor_type,rate_bps,fixed_fee_iqd,min_earning_iqd,max_earning_iqd,effective_from,effective_to,priority,is_active').single();
  if (error) throw new Error(`captain_earning_rule_create_failed: ${error.message}`);
  return data as CaptainEarningRule;
}

export async function updateCaptainEarningRule(id: string, patch: Partial<Omit<CaptainEarningRule,'id'>>) {
  const { data, error } = await supabase.from('captain_earning_rules').update(patch).eq('id',id).select('id,vendor_type,rate_bps,fixed_fee_iqd,min_earning_iqd,max_earning_iqd,effective_from,effective_to,priority,is_active').single();
  if (error) throw new Error(`captain_earning_rule_update_failed: ${error.message}`);
  return data as CaptainEarningRule;
}


export type CarListingFeeRule = {
  id: string;
  fee_iqd: number;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  is_active: boolean;
};

export async function getCarListingFeeRules() {
  const { data, error } = await supabase
    .from('car_listing_fee_rules')
    .select('id,fee_iqd,effective_from,effective_to,priority,is_active')
    .order('priority', { ascending: false })
    .order('effective_from', { ascending: false })
    .limit(30);
  if (error) throw new Error(`car_listing_fee_rules_load_failed: ${error.message}`);
  return (data ?? []) as CarListingFeeRule[];
}

export async function setCarListingFee(feeIqd: number) {
  if (!Number.isFinite(feeIqd) || feeIqd <= 0) throw new Error('invalid_car_listing_fee');
  const { data, error } = await supabase.rpc('set_car_listing_fee_rule', {
    p_fee_iqd: feeIqd,
    p_effective_from: new Date().toISOString(),
    p_effective_to: null,
    p_priority: 100,
  });
  if (error) throw new Error(`car_listing_fee_save_failed: ${error.message}`);
  return data as CarListingFeeRule;
}

export async function getCommissionRules() {
  const { data, error } = await supabase
    .from('commission_rules')
    .select('id,vendor_type,base_type,rate_bps,effective_from,effective_to,is_active,created_at')
    .order('effective_from', { ascending: false })
    .limit(30);
  if (error) throw new Error(`commission_rules_load_failed: ${error.message}`);
  return data ?? [];
}



export async function getFinancialDisputes(status?: FinancialDisputeStatus) {
  const { data, error } = await supabase.rpc('list_financial_disputes', { p_status: status ?? null });
  if (error) throw new Error(`financial_disputes_load_failed: ${error.message}`);
  return (data ?? []) as FinancialDispute[];
}

export async function createFinancialDispute(input: {
  dispute_type: FinancialDisputeType;
  order_id?: string;
  payment_intent_id?: string;
  payment_transaction_id?: string;
  refund_id?: string;
  cash_collection_id?: string;
  withdrawal_id?: string;
  payout_id?: string;
  amount_iqd: number;
  reason: string;
  provider?: string;
  provider_case_id?: string;
  provider_reference?: string;
  evidence?: Record<string, unknown>;
}) {
  const key = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
  const { data, error } = await supabase.rpc('open_financial_dispute', {
    p_dispute_type: input.dispute_type,
    p_order_id: input.order_id ?? null,
    p_payment_intent_id: input.payment_intent_id ?? null,
    p_payment_transaction_id: input.payment_transaction_id ?? null,
    p_refund_id: input.refund_id ?? null,
    p_cash_collection_id: input.cash_collection_id ?? null,
    p_withdrawal_id: input.withdrawal_id ?? null,
    p_payout_id: input.payout_id ?? null,
    p_amount_iqd: input.amount_iqd,
    p_reason: input.reason,
    p_provider: input.provider ?? null,
    p_provider_case_id: input.provider_case_id ?? null,
    p_provider_reference: input.provider_reference ?? null,
    p_evidence: input.evidence ?? {},
    p_idempotency_key: key,
  });
  if (error) throw new Error(`financial_dispute_create_failed: ${error.message}`);
  return data as FinancialDispute;
}

export async function updateFinancialDispute(
  disputeId: string,
  status: FinancialDisputeStatus,
  resolution?: string,
  assignedTo?: string,
  providerReference?: string,
  evidence?: Record<string, unknown>,
) {
  const { data, error } = await supabase.rpc('update_financial_dispute', {
    p_dispute_id: disputeId,
    p_status: status,
    p_resolution: resolution ?? null,
    p_assigned_to: assignedTo ?? null,
    p_provider_reference: providerReference ?? null,
    p_evidence: evidence ?? null,
  });
  if (error) throw new Error(`financial_dispute_update_failed: ${error.message}`);
  return data as FinancialDispute;
}
