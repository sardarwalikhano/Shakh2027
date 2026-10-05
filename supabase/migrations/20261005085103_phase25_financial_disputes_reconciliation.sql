-- SHAKH 2027 — Phase 25
-- Financial disputes, chargeback state, refund audit metadata and reconciliation anomalies.
-- Additive only: no existing business table/feature is removed.

alter table public.refunds
  add column if not exists provider text,
  add column if not exists provider_refund_id text,
  add column if not exists provider_reference text,
  add column if not exists failure_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete restrict;

create index if not exists idx_refunds_order_status_requested
  on public.refunds(order_id,status,requested_at desc);
create index if not exists idx_refunds_payment_transaction
  on public.refunds(payment_transaction_id);
create unique index if not exists uq_refunds_provider_refund_id
  on public.refunds(provider,provider_refund_id)
  where provider is not null and provider_refund_id is not null;

alter table public.payment_transactions
  drop constraint if exists payment_transactions_transaction_type_check;
alter table public.payment_transactions
  drop constraint if exists payment_transactions_transaction_type_check_v2;
alter table public.payment_transactions
  add constraint payment_transactions_transaction_type_check_v2
  check (transaction_type = any (array[
    'authorization'::text,'charge'::text,'refund'::text,'reversal'::text,'chargeback'::text
  ]));

create table if not exists public.financial_disputes (
  id uuid primary key default gen_random_uuid(),
  dispute_type text not null check (dispute_type in ('chargeback','payment_dispute','refund_dispute','cash_dispute','payout_dispute','order_dispute','other')),
  status text not null default 'open' check (status in ('open','in_review','accepted','rejected','resolved','cancelled')),
  order_id uuid references public.orders(id) on delete restrict,
  payment_intent_id uuid references public.payment_intents(id) on delete restrict,
  payment_transaction_id uuid references public.payment_transactions(id) on delete restrict,
  refund_id uuid references public.refunds(id) on delete restrict,
  cash_collection_id uuid references public.cash_collections(id) on delete restrict,
  withdrawal_id uuid references public.withdrawals(id) on delete restrict,
  payout_id uuid references public.payouts(id) on delete restrict,
  amount_iqd numeric(14,2) not null check(amount_iqd > 0),
  currency text not null default 'IQD' check(currency='IQD'),
  reason text not null,
  evidence jsonb not null default '{}'::jsonb,
  provider text,
  provider_case_id text,
  provider_reference text,
  resolution text,
  reported_by uuid not null references auth.users(id) on delete restrict,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  idempotency_key text not null,
  opened_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint financial_disputes_entity_required check (
    order_id is not null or payment_intent_id is not null or payment_transaction_id is not null
    or refund_id is not null or cash_collection_id is not null or withdrawal_id is not null or payout_id is not null
  ),
  unique(reported_by,idempotency_key)
);

create unique index if not exists uq_financial_disputes_provider_case
  on public.financial_disputes(provider,provider_case_id)
  where provider is not null and provider_case_id is not null;
create index if not exists idx_financial_disputes_status_created on public.financial_disputes(status,created_at desc);
create index if not exists idx_financial_disputes_order on public.financial_disputes(order_id);
create index if not exists idx_financial_disputes_payment_intent on public.financial_disputes(payment_intent_id);
create index if not exists idx_financial_disputes_refund on public.financial_disputes(refund_id);
create index if not exists idx_financial_disputes_cash on public.financial_disputes(cash_collection_id);
create index if not exists idx_financial_disputes_withdrawal on public.financial_disputes(withdrawal_id);
create index if not exists idx_financial_disputes_payout on public.financial_disputes(payout_id);
create index if not exists idx_financial_disputes_reporter on public.financial_disputes(reported_by,created_at desc);

alter table public.financial_disputes enable row level security;
drop policy if exists "financial disputes read own or finance" on public.financial_disputes;
create policy "financial disputes read own or finance"
on public.financial_disputes for select to authenticated
using (reported_by=(select auth.uid()) or (select private.has_permission('finance.read')));

revoke all on table public.financial_disputes from anon,authenticated;
grant select on table public.financial_disputes to authenticated;

create or replace function private.set_financial_dispute_updated_at()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$ begin new.updated_at:=now(); return new; end; $$;
revoke execute on function private.set_financial_dispute_updated_at() from public,anon,authenticated;
drop trigger if exists financial_disputes_set_updated_at on public.financial_disputes;
create trigger financial_disputes_set_updated_at before update on public.financial_disputes
for each row execute function private.set_financial_dispute_updated_at();

create or replace function private.open_financial_dispute(
  p_dispute_type text,
  p_order_id uuid default null,
  p_payment_intent_id uuid default null,
  p_payment_transaction_id uuid default null,
  p_refund_id uuid default null,
  p_cash_collection_id uuid default null,
  p_withdrawal_id uuid default null,
  p_payout_id uuid default null,
  p_amount_iqd numeric default null,
  p_reason text default null,
  p_provider text default null,
  p_provider_case_id text default null,
  p_provider_reference text default null,
  p_evidence jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns public.financial_disputes language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_existing public.financial_disputes%rowtype;
  v_row public.financial_disputes%rowtype;
  v_finance boolean:=private.has_permission('finance.manage');
  v_owner_ok boolean:=false;
  v_max_amount numeric(14,2);
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if p_dispute_type is null or p_dispute_type not in ('chargeback','payment_dispute','refund_dispute','cash_dispute','payout_dispute','order_dispute','other') then raise exception 'invalid_dispute_type' using errcode='P0001'; end if;
  if p_reason is null or length(trim(p_reason)) not between 3 and 2000 then raise exception 'invalid_dispute_reason' using errcode='P0001'; end if;
  if p_amount_iqd is null or p_amount_iqd<=0 then raise exception 'invalid_dispute_amount' using errcode='P0001'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) not between 16 and 128 then raise exception 'invalid_idempotency_key' using errcode='P0001'; end if;
  select * into v_existing from public.financial_disputes where reported_by=v_user_id and idempotency_key=trim(p_idempotency_key) for update;
  if found then return v_existing; end if;
  if p_order_id is null and p_payment_intent_id is null and p_payment_transaction_id is null and p_refund_id is null and p_cash_collection_id is null and p_withdrawal_id is null and p_payout_id is null then raise exception 'dispute_entity_required' using errcode='P0001'; end if;

  if p_order_id is not null then
    select o.total_iqd,(o.buyer_user_id=v_user_id) into v_max_amount,v_owner_ok from public.orders o where o.id=p_order_id;
    if not found then raise exception 'order_not_found' using errcode='P0001'; end if;
  end if;
  if p_payment_intent_id is not null then
    select pi.amount_iqd,(pi.buyer_user_id=v_user_id) into v_max_amount,v_owner_ok from public.payment_intents pi where pi.id=p_payment_intent_id;
    if not found then raise exception 'payment_intent_not_found' using errcode='P0001'; end if;
  end if;
  if p_payment_transaction_id is not null then
    select pt.amount_iqd,(pi.buyer_user_id=v_user_id) into v_max_amount,v_owner_ok from public.payment_transactions pt join public.payment_intents pi on pi.id=pt.payment_intent_id where pt.id=p_payment_transaction_id;
    if not found then raise exception 'payment_transaction_not_found' using errcode='P0001'; end if;
  end if;
  if p_refund_id is not null then
    select r.amount_iqd,(o.buyer_user_id=v_user_id or r.requested_by=v_user_id) into v_max_amount,v_owner_ok from public.refunds r join public.orders o on o.id=r.order_id where r.id=p_refund_id;
    if not found then raise exception 'refund_not_found' using errcode='P0001'; end if;
  end if;
  if p_cash_collection_id is not null then
    select cc.amount_iqd,(cc.captain_user_id=v_user_id or o.buyer_user_id=v_user_id) into v_max_amount,v_owner_ok from public.cash_collections cc join public.orders o on o.id=cc.order_id where cc.id=p_cash_collection_id;
    if not found then raise exception 'cash_collection_not_found' using errcode='P0001'; end if;
  end if;
  if p_withdrawal_id is not null then
    select w.amount_iqd,(w.requested_by=v_user_id) into v_max_amount,v_owner_ok from public.withdrawals w where w.id=p_withdrawal_id;
    if not found then raise exception 'withdrawal_not_found' using errcode='P0001'; end if;
  end if;
  if p_payout_id is not null then
    select p.amount_iqd,(w.requested_by=v_user_id) into v_max_amount,v_owner_ok from public.payouts p join public.withdrawals w on w.id=p.withdrawal_id where p.id=p_payout_id;
    if not found then raise exception 'payout_not_found' using errcode='P0001'; end if;
  end if;
  if not v_finance and not coalesce(v_owner_ok,false) then raise exception 'dispute_not_authorized' using errcode='P0001'; end if;
  if not v_finance and p_amount_iqd>coalesce(v_max_amount,0) then raise exception 'dispute_amount_exceeds_reference' using errcode='P0001'; end if;

  insert into public.financial_disputes(
    dispute_type,order_id,payment_intent_id,payment_transaction_id,refund_id,cash_collection_id,withdrawal_id,payout_id,
    amount_iqd,reason,evidence,provider,provider_case_id,provider_reference,reported_by,idempotency_key
  ) values(
    p_dispute_type,p_order_id,p_payment_intent_id,p_payment_transaction_id,p_refund_id,p_cash_collection_id,p_withdrawal_id,p_payout_id,
    p_amount_iqd,trim(p_reason),coalesce(p_evidence,'{}'::jsonb),nullif(trim(p_provider),''),nullif(trim(p_provider_case_id),''),
    nullif(trim(p_provider_reference),''),v_user_id,trim(p_idempotency_key)
  ) returning * into v_row;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(v_user_id,'financial_dispute_opened','financial_dispute',v_row.id,
         jsonb_build_object('dispute_type',v_row.dispute_type,'amount_iqd',v_row.amount_iqd,'order_id',v_row.order_id,
                            'payment_intent_id',v_row.payment_intent_id,'refund_id',v_row.refund_id,
                            'provider',v_row.provider,'provider_case_id',v_row.provider_case_id));
  return v_row;
end;
$$;
revoke execute on function private.open_financial_dispute(text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,text,text,text,text,jsonb,text) from public,anon,authenticated;

create or replace function public.open_financial_dispute(
  p_dispute_type text,p_order_id uuid default null,p_payment_intent_id uuid default null,p_payment_transaction_id uuid default null,
  p_refund_id uuid default null,p_cash_collection_id uuid default null,p_withdrawal_id uuid default null,p_payout_id uuid default null,
  p_amount_iqd numeric default null,p_reason text default null,p_provider text default null,p_provider_case_id text default null,
  p_provider_reference text default null,p_evidence jsonb default '{}'::jsonb,p_idempotency_key text default null
)
returns public.financial_disputes language sql security invoker
set search_path='pg_catalog','public','private'
as $$ select private.open_financial_dispute(p_dispute_type,p_order_id,p_payment_intent_id,p_payment_transaction_id,p_refund_id,p_cash_collection_id,p_withdrawal_id,p_payout_id,p_amount_iqd,p_reason,p_provider,p_provider_case_id,p_provider_reference,p_evidence,p_idempotency_key); $$;
revoke all on function public.open_financial_dispute(text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,text,text,text,text,jsonb,text) from public,anon;
grant execute on function public.open_financial_dispute(text,uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,text,text,text,text,jsonb,text) to authenticated;

create or replace function private.update_financial_dispute(
  p_dispute_id uuid,p_status text,p_resolution text default null,p_assigned_to uuid default null,p_provider_reference text default null,p_evidence jsonb default null
)
returns public.financial_disputes language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare
  v_user_id uuid:=auth.uid();
  v_row public.financial_disputes%rowtype;
  v_old_status text;
begin
  if v_user_id is null then raise exception 'not_authenticated' using errcode='P0001'; end if;
  if not private.has_permission('finance.manage') then raise exception 'finance_permission_required' using errcode='P0001'; end if;
  if p_status is null or p_status not in ('open','in_review','accepted','rejected','resolved','cancelled') then raise exception 'invalid_dispute_status' using errcode='P0001'; end if;
  select * into v_row from public.financial_disputes where id=p_dispute_id for update;
  if not found then raise exception 'financial_dispute_not_found' using errcode='P0001'; end if;
  v_old_status:=v_row.status;
  if v_old_status<>p_status and not (
    (v_old_status='open' and p_status in ('in_review','cancelled')) or
    (v_old_status='in_review' and p_status in ('accepted','rejected','resolved','cancelled')) or
    (v_old_status='accepted' and p_status='resolved')
  ) then raise exception 'invalid_dispute_transition' using errcode='P0001'; end if;

  update public.financial_disputes
  set status=p_status,
      resolution=coalesce(nullif(trim(p_resolution),''),resolution),
      assigned_to=coalesce(p_assigned_to,assigned_to),
      provider_reference=coalesce(nullif(trim(p_provider_reference),''),provider_reference),
      evidence=coalesce(p_evidence,evidence),
      resolved_by=case when p_status in ('resolved','rejected','cancelled') then v_user_id else resolved_by end,
      resolved_at=case when p_status in ('resolved','rejected','cancelled') then coalesce(resolved_at,now()) else null end,
      updated_at=now()
  where id=p_dispute_id returning * into v_row;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
  values(v_user_id,'financial_dispute_status_changed','financial_dispute',v_row.id,
         jsonb_build_object('old_status',v_old_status,'new_status',v_row.status,'resolution',v_row.resolution,
                            'assigned_to',v_row.assigned_to,'provider_reference',v_row.provider_reference));
  return v_row;
end;
$$;
revoke execute on function private.update_financial_dispute(uuid,text,text,uuid,text,jsonb) from public,anon,authenticated;

create or replace function public.update_financial_dispute(
  p_dispute_id uuid,p_status text,p_resolution text default null,p_assigned_to uuid default null,p_provider_reference text default null,p_evidence jsonb default null
)
returns public.financial_disputes language sql security invoker
set search_path='pg_catalog','public','private'
as $$ select private.update_financial_dispute(p_dispute_id,p_status,p_resolution,p_assigned_to,p_provider_reference,p_evidence); $$;
revoke all on function public.update_financial_dispute(uuid,text,text,uuid,text,jsonb) from public,anon;
grant execute on function public.update_financial_dispute(uuid,text,text,uuid,text,jsonb) to authenticated;

create or replace function public.list_financial_disputes(p_status text default null)
returns setof public.financial_disputes language sql security invoker
set search_path='pg_catalog','public','private'
as $$ select * from public.financial_disputes where p_status is null or status=p_status order by created_at desc limit 100; $$;
revoke all on function public.list_financial_disputes(text) from public,anon;
grant execute on function public.list_financial_disputes(text) to authenticated;

create or replace function private.set_refund_updated_at()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$ begin new.updated_at:=now(); return new; end; $$;
revoke execute on function private.set_refund_updated_at() from public,anon,authenticated;
drop trigger if exists refunds_set_updated_at_phase25 on public.refunds;
create trigger refunds_set_updated_at_phase25 before update on public.refunds for each row execute function private.set_refund_updated_at();

create or replace function private.audit_refund_change()
returns trigger language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare v_actor uuid:=auth.uid(); v_entity_id uuid; v_action text; v_row jsonb;
begin
  if tg_op='DELETE' then
    v_entity_id:=old.id; v_action:='refund_deleted'; v_row:=jsonb_build_object('status',old.status,'amount_iqd',old.amount_iqd,'order_id',old.order_id);
  elsif tg_op='UPDATE' then
    v_entity_id:=new.id; v_action:=case when old.status is distinct from new.status then 'refund_status_changed' else 'refund_updated' end;
    v_row:=jsonb_build_object('status',new.status,'amount_iqd',new.amount_iqd,'order_id',new.order_id,'provider',new.provider,
                              'provider_refund_id',new.provider_refund_id,'provider_reference',new.provider_reference,'payment_transaction_id',new.payment_transaction_id);
  else
    v_entity_id:=new.id; v_action:='refund_created'; v_row:=jsonb_build_object('status',new.status,'amount_iqd',new.amount_iqd,'order_id',new.order_id,
                              'provider',new.provider,'provider_refund_id',new.provider_refund_id,'provider_reference',new.provider_reference,'payment_transaction_id',new.payment_transaction_id);
  end if;
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata) values(v_actor,v_action,'refund',v_entity_id,v_row);
  return coalesce(new,old);
end;
$$;
revoke execute on function private.audit_refund_change() from public,anon,authenticated;
drop trigger if exists refunds_audit_phase25 on public.refunds;
create trigger refunds_audit_phase25 after insert or update or delete on public.refunds for each row execute function private.audit_refund_change();

revoke execute on function private.process_wallet_refund(uuid,numeric,text,text) from authenticated;

create or replace function private.get_finance_reconciliation_snapshot_v2()
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','private'
as $$
declare v_result jsonb;
begin
  if not private.has_permission('finance.read') then raise exception 'finance_permission_required' using errcode='P0001'; end if;
  with anomaly_rows as (
    select 'refund_financial_mismatch'::text code,'critical'::text severity,r.order_id entity_id,r.order_id,
           sum(r.amount_iqd) filter(where r.status='processed') observed_iqd,max(of.refunded_iqd) expected_iqd,
           'Processed refunds do not equal order_financials.refunded_iqd'::text message
    from public.refunds r join public.order_financials of on of.order_id=r.order_id
    group by r.order_id
    having sum(r.amount_iqd) filter(where r.status='processed') is distinct from max(of.refunded_iqd)

    union all
    select 'refund_ledger_mismatch','critical',r.id,r.order_id,
           coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.wallet_id=r.customer_wallet_id and le.direction='credit' and le.entry_type='refund' and le.idempotency_key='refund-customer:'||r.id::text),0),
           r.amount_iqd,'Customer refund ledger credit does not equal refund amount'
    from public.refunds r
    where r.status='processed' and coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.wallet_id=r.customer_wallet_id and le.direction='credit' and le.entry_type='refund' and le.idempotency_key='refund-customer:'||r.id::text),0)<>r.amount_iqd

    union all
    select 'refund_source_ledger_mismatch','critical',r.id,r.order_id,
           coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.reference_type='refund' and le.reference_id=r.id and le.direction='debit' and le.entry_type='refund'),0),
           r.amount_iqd,'Vendor/platform refund debits do not equal refund amount'
    from public.refunds r
    where r.status='processed' and coalesce((select sum(le.amount_iqd) from public.wallet_ledger_entries le where le.reference_type='refund' and le.reference_id=r.id and le.direction='debit' and le.entry_type='refund'),0)<>r.amount_iqd

    union all
    select 'captain_earning_unlinked','high',ce.id,ce.order_id,ce.earning_iqd,ce.earning_iqd,'Settled captain earning has no wallet ledger entry'
    from public.captain_earnings ce where ce.status='settled' and ce.ledger_entry_id is null

    union all
    select 'withdrawal_payout_mismatch','high',w.id,null::uuid,case when w.status='paid' then 1 else 0 end,case when coalesce(p.status,'')='paid' then 1 else 0 end,'Withdrawal and payout terminal state disagree'
    from public.withdrawals w left join public.payouts p on p.withdrawal_id=w.id
    where (w.status='paid' and coalesce(p.status,'')<>'paid') or (w.status in('failed','rejected','cancelled') and coalesce(p.status,'')<>'failed')

    union all
    select 'succeeded_payment_order_mismatch','high',pi.id,null::uuid,pi.amount_iqd,0,'A succeeded payment intent still has an unpaid active order in its checkout session'
    from public.payment_intents pi
    where pi.status='succeeded' and pi.checkout_session_id is not null
      and exists(select 1 from public.orders o where o.checkout_session_id=pi.checkout_session_id and o.status not in('cancelled','refunded') and o.payment_status<>'paid')
  )
  select jsonb_build_object(
    'captain',jsonb_build_object(
      'earned_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled'),0),
      'ledger_credited_iqd',coalesce((select sum(ce.earning_iqd) from public.captain_earnings ce join public.wallet_ledger_entries le on le.id=ce.ledger_entry_id where ce.status='settled'),0),
      'unlinked_earnings_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled' and ledger_entry_id is null),0),
      'settled_deliveries',coalesce((select count(*) from public.captain_earnings where status='settled'),0)
    ),
    'cash',jsonb_build_object(
      'collected_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='collected'),0),
      'deposited_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='deposited'),0),
      'reconciled_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='reconciled'),0),
      'disputed_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='disputed'),0)
    ),
    'payouts',jsonb_build_object(
      'pending_iqd',coalesce((select sum(amount_iqd) from public.payouts where status in('queued','processing')),0),
      'paid_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='paid'),0),
      'failed_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='failed'),0)
    ),
    'withdrawals',jsonb_build_object(
      'requested_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='requested'),0),
      'approved_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status in('approved','processing')),0),
      'failed_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='failed'),0)
    ),
    'disputes',jsonb_build_object(
      'open_count',coalesce((select count(*) from public.financial_disputes where status='open'),0),
      'in_review_count',coalesce((select count(*) from public.financial_disputes where status='in_review'),0),
      'accepted_iqd',coalesce((select sum(amount_iqd) from public.financial_disputes where status='accepted'),0),
      'rejected_iqd',coalesce((select sum(amount_iqd) from public.financial_disputes where status='rejected'),0)
    ),
    'recent_captain_earnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (
      select ce.id,ce.order_id,o.order_number,ce.captain_user_id,cp.captain_code,ce.delivery_fee_iqd,ce.earning_iqd,ce.ledger_entry_id,ce.status,ce.settled_at,ce.created_at
      from public.captain_earnings ce join public.orders o on o.id=ce.order_id join public.captain_profiles cp on cp.user_id=ce.captain_user_id
      order by ce.created_at desc limit 50) q),'[]'::jsonb),
    'outstanding_cash_collections',coalesce((select jsonb_agg(to_jsonb(q) order by q.collected_at asc) from (
      select cc.id,cc.order_id,o.order_number,cc.captain_user_id,cp.captain_code,cc.amount_iqd,cc.status,cc.collected_at,cc.deposit_reference,cc.notes
      from public.cash_collections cc join public.orders o on o.id=cc.order_id join public.captain_profiles cp on cp.user_id=cc.captain_user_id
      where cc.status in('collected','deposited','disputed') order by cc.collected_at asc limit 50) q),'[]'::jsonb),
    'anomalies',coalesce((select jsonb_agg(to_jsonb(a) order by case a.severity when 'critical' then 1 when 'high' then 2 else 3 end,a.code,a.entity_id) from anomaly_rows a),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke execute on function private.get_finance_reconciliation_snapshot_v2() from public,anon,authenticated;

create or replace function public.get_finance_reconciliation_snapshot()
returns jsonb language sql security invoker
set search_path='pg_catalog','public','private'
as $$ select private.get_finance_reconciliation_snapshot_v2(); $$;
revoke all on function public.get_finance_reconciliation_snapshot() from public,anon;
grant execute on function public.get_finance_reconciliation_snapshot() to authenticated;
