-- SHAKH 2027 — Phase 25 reconciliation NULL hardening
-- Prevents a NULL SUM(FILTER...) from being reported as a false refund mismatch.
create or replace function private.get_finance_reconciliation_snapshot_v2()
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare v_result jsonb;
begin
  if not private.has_permission('finance.read') then raise exception 'finance_permission_required' using errcode='P0001'; end if;
  with anomaly_rows as (
    select 'refund_financial_mismatch'::text code,'critical'::text severity,r.order_id entity_id,r.order_id,
           coalesce(sum(r.amount_iqd) filter(where r.status='processed'),0) observed_iqd,
           coalesce(max(of.refunded_iqd),0) expected_iqd,
           'Processed refunds do not equal order_financials.refunded_iqd'::text message
    from public.refunds r join public.order_financials of on of.order_id=r.order_id
    group by r.order_id
    having coalesce(sum(r.amount_iqd) filter(where r.status='processed'),0) is distinct from coalesce(max(of.refunded_iqd),0)
    union all
    select 'refund_ledger_mismatch','critical',r.id,r.order_id,
           coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.wallet_id=r.customer_wallet_id and le.direction='credit' and le.entry_type='refund' and le.idempotency_key='refund-customer:'||r.id::text),0),
           r.amount_iqd,'Customer refund ledger credit does not equal refund amount'
    from public.refunds r where r.status='processed'
      and coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.wallet_id=r.customer_wallet_id and le.direction='credit' and le.entry_type='refund' and le.idempotency_key='refund-customer:'||r.id::text),0)<>r.amount_iqd
    union all
    select 'refund_source_ledger_mismatch','critical',r.id,r.order_id,
           coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.reference_type='refund' and le.reference_id=r.id and le.direction='debit' and le.entry_type='refund'),0),
           r.amount_iqd,'Vendor/platform refund debits do not equal refund amount'
    from public.refunds r where r.status='processed'
      and coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.reference_type='refund' and le.reference_id=r.id and le.direction='debit' and le.entry_type='refund'),0)<>r.amount_iqd
    union all
    select 'captain_earning_unlinked','high',ce.id,ce.order_id,ce.earning_iqd,ce.earning_iqd,'Settled captain earning has no wallet ledger entry'
    from public.captain_earnings ce where ce.status='settled' and ce.ledger_entry_id is null
    union all
    select 'withdrawal_payout_mismatch','high',w.id,null::uuid,case when w.status='paid' then 1 else 0 end,case when coalesce(p.status,'')='paid' then 1 else 0 end,'Withdrawal and payout terminal state disagree'
    from public.withdrawals w left join public.payouts p on p.withdrawal_id=w.id
    where (w.status='paid' and coalesce(p.status,'')<>'paid') or (w.status in('failed','rejected','cancelled') and coalesce(p.status,'')<>'failed')
    union all
    select 'succeeded_payment_order_mismatch','high',pi.id,null::uuid,pi.amount_iqd,0,'A succeeded payment intent still has an unpaid active order in its checkout session'
    from public.payment_intents pi where pi.status='succeeded' and pi.checkout_session_id is not null
      and exists(select 1 from public.orders o where o.checkout_session_id=pi.checkout_session_id and o.status not in('cancelled','refunded') and o.payment_status<>'paid')
  )
  select jsonb_build_object(
    'captain',jsonb_build_object('earned_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled'),0),'ledger_credited_iqd',coalesce((select sum(ce.earning_iqd) from public.captain_earnings ce join public.wallet_ledger_entries le on le.id=ce.ledger_entry_id where ce.status='settled'),0),'unlinked_earnings_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled' and ledger_entry_id is null),0),'settled_deliveries',coalesce((select count(*) from public.captain_earnings where status='settled'),0)),
    'cash',jsonb_build_object('collected_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='collected'),0),'deposited_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='deposited'),0),'reconciled_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='reconciled'),0),'disputed_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='disputed'),0)),
    'payouts',jsonb_build_object('pending_iqd',coalesce((select sum(amount_iqd) from public.payouts where status in('queued','processing')),0),'paid_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='paid'),0),'failed_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='failed'),0)),
    'withdrawals',jsonb_build_object('requested_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='requested'),0),'approved_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status in('approved','processing')),0),'failed_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='failed'),0)),
    'disputes',jsonb_build_object('open_count',coalesce((select count(*) from public.financial_disputes where status='open'),0),'in_review_count',coalesce((select count(*) from public.financial_disputes where status='in_review'),0),'accepted_iqd',coalesce((select sum(amount_iqd) from public.financial_disputes where status='accepted'),0),'rejected_iqd',coalesce((select sum(amount_iqd) from public.financial_disputes where status='rejected'),0)),
    'recent_captain_earnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select ce.id,ce.order_id,o.order_number,ce.captain_user_id,cp.captain_code,ce.delivery_fee_iqd,ce.earning_iqd,ce.ledger_entry_id,ce.status,ce.settled_at,ce.created_at from public.captain_earnings ce join public.orders o on o.id=ce.order_id join public.captain_profiles cp on cp.user_id=ce.captain_user_id order by ce.created_at desc limit 50) q),'[]'::jsonb),
    'outstanding_cash_collections',coalesce((select jsonb_agg(to_jsonb(q) order by q.collected_at asc) from (select cc.id,cc.order_id,o.order_number,cc.captain_user_id,cp.captain_code,cc.amount_iqd,cc.status,cc.collected_at,cc.deposit_reference,cc.notes from public.cash_collections cc join public.orders o on o.id=cc.order_id join public.captain_profiles cp on cp.user_id=cc.captain_user_id where cc.status in('collected','deposited','disputed') order by cc.collected_at asc limit 50) q),'[]'::jsonb),
    'anomalies',coalesce((select jsonb_agg(to_jsonb(a) order by case a.severity when 'critical' then 1 when 'high' then 2 else 3 end,a.code,a.entity_id) from anomaly_rows a),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function private.get_finance_reconciliation_snapshot_v2() from public,anon,authenticated;
