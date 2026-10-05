-- SHAKH 2027 — Phase 25 FK indexes
create index if not exists idx_financial_disputes_assigned_to on public.financial_disputes(assigned_to);
create index if not exists idx_financial_disputes_resolved_by on public.financial_disputes(resolved_by);
create index if not exists idx_financial_disputes_payment_transaction on public.financial_disputes(payment_transaction_id);
