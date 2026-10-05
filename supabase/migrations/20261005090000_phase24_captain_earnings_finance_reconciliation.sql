-- SHAKH Phase 24
-- Captain Earnings + Finance Reconciliation
-- Idempotent migration source for the live Phase 24 implementation.

create table if not exists public.captain_earning_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_type text,
  rate_bps integer not null default 0 check(rate_bps>=0 and rate_bps<=10000),
  fixed_fee_iqd numeric(14,2) not null default 0 check(fixed_fee_iqd>=0),
  min_earning_iqd numeric(14,2) not null default 0 check(min_earning_iqd>=0),
  max_earning_iqd numeric(14,2),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  priority integer not null default 0 check(priority>=0),
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(max_earning_iqd is null or max_earning_iqd>=min_earning_iqd),
  check(effective_to is null or effective_to>effective_from)
);

create table if not exists public.captain_earnings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.delivery_assignments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  captain_user_id uuid not null references public.captain_profiles(user_id) on delete restrict,
  delivery_fee_iqd numeric(14,2) not null default 0 check(delivery_fee_iqd>=0),
  earning_iqd numeric(14,2) not null default 0 check(earning_iqd>=0),
  rule_id uuid references public.captain_earning_rules(id) on delete set null,
  status text not null default 'settled' check(status in ('settled','reversed')),
  ledger_entry_id uuid references public.wallet_ledger_entries(id) on delete set null,
  idempotency_key text not null unique,
  settled_at timestamptz not null default now(),
  reversed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_captain_earning_rules_vendor_active on public.captain_earning_rules(vendor_type,is_active,effective_from desc,priority desc);
create index if not exists idx_captain_earning_rules_created_by on public.captain_earning_rules(created_by);
create index if not exists idx_captain_earnings_captain_created on public.captain_earnings(captain_user_id,created_at desc);
create index if not exists idx_captain_earnings_order on public.captain_earnings(order_id);
create index if not exists idx_captain_earnings_status_created on public.captain_earnings(status,created_at desc);
create index if not exists idx_captain_earnings_ledger_entry on public.captain_earnings(ledger_entry_id);
create index if not exists idx_captain_earnings_rule on public.captain_earnings(rule_id);

alter table public.captain_earning_rules enable row level security;
alter table public.captain_earnings enable row level security;

drop policy if exists "finance managers manage earning rules" on public.captain_earning_rules;
drop policy if exists "finance managers read earning rules" on public.captain_earning_rules;
create policy "finance managers read earning rules" on public.captain_earning_rules
for select to authenticated using((select private.has_permission('finance.read')));
create policy "finance managers insert earning rules" on public.captain_earning_rules
for insert to authenticated with check((select private.has_permission('finance.manage')));
create policy "finance managers update earning rules" on public.captain_earning_rules
for update to authenticated using((select private.has_permission('finance.manage'))) with check((select private.has_permission('finance.manage')));

drop policy if exists "captains read own earnings" on public.captain_earnings;
create policy "captains read own earnings" on public.captain_earnings
for select to authenticated using(captain_user_id=(select auth.uid()) or (select private.has_permission('finance.read')));

grant select,insert,update on public.captain_earning_rules to authenticated;
grant select on public.captain_earnings to authenticated;

create or replace function private.calculate_captain_earning(p_delivery_fee_iqd numeric,p_vendor_type text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_rule public.captain_earning_rules%rowtype; v_fee numeric:=greatest(coalesce(p_delivery_fee_iqd,0),0); v_earning numeric:=0;
begin
 select * into v_rule from public.captain_earning_rules r
 where r.is_active=true and r.effective_from<=now() and (r.effective_to is null or r.effective_to>now())
 and (r.vendor_type is null or r.vendor_type=p_vendor_type)
 order by case when r.vendor_type is null then 1 else 0 end asc,r.priority desc,r.effective_from desc,r.updated_at desc limit 1;
 if found then
   v_earning:=v_rule.fixed_fee_iqd+(v_fee*v_rule.rate_bps/10000.0);
   v_earning:=greatest(v_earning,v_rule.min_earning_iqd);
   if v_rule.max_earning_iqd is not null then v_earning:=least(v_earning,v_rule.max_earning_iqd); end if;
   v_earning:=least(greatest(round(v_earning,0),0),v_fee);
 end if;
 return jsonb_build_object('earning_iqd',v_earning,'rule_id',case when found then v_rule.id else null end,'configured',found);
end; $$;
revoke all on function private.calculate_captain_earning(numeric,text) from public,anon,authenticated;

-- The live implementation also extends private.assign_captain_to_order so the earning snapshot
-- is calculated from the active rule and stored in delivery_assignments.captain_earning_iqd.
-- It settles exactly once when the assignment transitions to delivered.

create or replace function private.settle_captain_earning(p_assignment_id uuid)
returns public.captain_earnings language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_assignment public.delivery_assignments%rowtype; v_earning public.captain_earnings%rowtype; v_wallet public.wallets%rowtype; v_id uuid;
begin
 select * into v_assignment from public.delivery_assignments where id=p_assignment_id for update;
 if not found then raise exception 'assignment_not_found' using errcode='P0001'; end if;
 if v_assignment.captain_user_id is null then raise exception 'captain_not_assigned' using errcode='P0001'; end if;
 if v_assignment.status<>'delivered' then raise exception 'assignment_not_delivered' using errcode='P0001'; end if;
 insert into public.wallets(wallet_type,owner_user_id,currency,balance_iqd,status)
 values('captain',v_assignment.captain_user_id,'IQD',0,'active')
 on conflict (owner_user_id) where wallet_type='captain' do nothing;
 select * into v_wallet from public.wallets where wallet_type='captain' and owner_user_id=v_assignment.captain_user_id and status='active' for update;
 if not found then raise exception 'captain_wallet_not_found' using errcode='P0001'; end if;
 insert into public.captain_earnings(assignment_id,order_id,captain_user_id,delivery_fee_iqd,earning_iqd,status,idempotency_key,settled_at)
 values(v_assignment.id,v_assignment.order_id,v_assignment.captain_user_id,greatest(coalesce(v_assignment.delivery_fee_iqd,0),0),greatest(coalesce(v_assignment.captain_earning_iqd,0),0),'settled','captain-earning:'||v_assignment.id::text,now())
 on conflict (assignment_id) do nothing returning * into v_earning;
 if not found then select * into v_earning from public.captain_earnings where assignment_id=v_assignment.id for update; return v_earning; end if;
 if v_earning.earning_iqd>0 then
   select id into v_id from public.wallet_ledger_entries where wallet_id=v_wallet.id and idempotency_key=v_earning.idempotency_key;
   if v_id is null then
     v_id:=(private.insert_ledger_entry(v_wallet.id,'credit','captain_delivery_earning',v_earning.earning_iqd,'captain_earning',v_earning.id,v_earning.idempotency_key,'Captain earning for delivered order')).id;
   end if;
   update public.captain_earnings set ledger_entry_id=v_id,settled_at=coalesce(settled_at,now()) where id=v_earning.id returning * into v_earning;
 end if;
 return v_earning;
end; $$;
revoke all on function private.settle_captain_earning(uuid) from public,anon,authenticated;

create or replace function private.settle_captain_earning_trigger() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin perform private.settle_captain_earning(new.id); return new; end; $$;
revoke all on function private.settle_captain_earning_trigger() from public,anon,authenticated;
drop trigger if exists delivery_assignment_captain_earning_settlement on public.delivery_assignments;
create trigger delivery_assignment_captain_earning_settlement after update of status on public.delivery_assignments
for each row when (new.status='delivered' and old.status is distinct from new.status)
execute function private.settle_captain_earning_trigger();

create or replace function private.get_captain_finance_snapshot(p_captain_user_id uuid default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare v_target uuid:=coalesce(p_captain_user_id,auth.uid()); v_me uuid:=auth.uid(); v_ops boolean:=private.has_permission('finance.read');
begin
 if v_target is null or (v_target<>v_me and not v_ops) then raise exception 'captain_finance_forbidden' using errcode='P0001'; end if;
 return jsonb_build_object(
  'wallet',(select to_jsonb(w) from public.wallets w where w.wallet_type='captain' and w.owner_user_id=v_target),
  'earnings',jsonb_build_object('lifetime_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where captain_user_id=v_target and status='settled'),0),'last_30_days_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where captain_user_id=v_target and status='settled' and created_at>=now()-interval '30 days'),0),'deliveries',coalesce((select count(*) from public.captain_earnings where captain_user_id=v_target and status='settled'),0)),
  'cash_collection',jsonb_build_object('collected_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where captain_user_id=v_target and status in('collected','deposited')),0),'reconciled_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where captain_user_id=v_target and status='reconciled'),0),'outstanding_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where captain_user_id=v_target and status in('collected','deposited')),0)),
  'recent_earnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select ce.id,ce.order_id,o.order_number,ce.assignment_id,ce.delivery_fee_iqd,ce.earning_iqd,ce.status,ce.settled_at,ce.created_at from public.captain_earnings ce join public.orders o on o.id=ce.order_id where ce.captain_user_id=v_target order by ce.created_at desc limit 20) q),'[]'::jsonb)
 );
end; $$;
create or replace function public.get_captain_finance_snapshot(p_captain_user_id uuid default null) returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_captain_finance_snapshot(p_captain_user_id); $$;
revoke all on function private.get_captain_finance_snapshot(uuid) from public,anon,authenticated;
revoke all on function public.get_captain_finance_snapshot(uuid) from public,anon;
grant execute on function public.get_captain_finance_snapshot(uuid) to authenticated;

create or replace function private.get_finance_reconciliation_snapshot() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 if not private.has_permission('finance.read') then raise exception 'finance_permission_required' using errcode='P0001'; end if;
 return jsonb_build_object(
  'captain',jsonb_build_object('earned_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled'),0),'ledger_credited_iqd',coalesce((select sum(ce.earning_iqd) from public.captain_earnings ce join public.wallet_ledger_entries le on le.id=ce.ledger_entry_id where ce.status='settled'),0),'unlinked_earnings_iqd',coalesce((select sum(earning_iqd) from public.captain_earnings where status='settled' and ledger_entry_id is null),0),'settled_deliveries',coalesce((select count(*) from public.captain_earnings where status='settled'),0)),
  'cash',jsonb_build_object('collected_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='collected'),0),'deposited_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='deposited'),0),'reconciled_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='reconciled'),0),'disputed_iqd',coalesce((select sum(amount_iqd) from public.cash_collections where status='disputed'),0)),
  'payouts',jsonb_build_object('pending_iqd',coalesce((select sum(amount_iqd) from public.payouts where status in('pending','processing')),0),'paid_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='paid'),0),'failed_iqd',coalesce((select sum(amount_iqd) from public.payouts where status='failed'),0)),
  'withdrawals',jsonb_build_object('requested_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='requested'),0),'approved_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status in('approved','processing')),0),'failed_iqd',coalesce((select sum(amount_iqd) from public.withdrawals where status='failed'),0)),
  'recent_captain_earnings',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc) from (select ce.id,ce.order_id,o.order_number,ce.captain_user_id,cp.captain_code,ce.delivery_fee_iqd,ce.earning_iqd,ce.ledger_entry_id,ce.status,ce.settled_at,ce.created_at from public.captain_earnings ce join public.orders o on o.id=ce.order_id join public.captain_profiles cp on cp.user_id=ce.captain_user_id order by ce.created_at desc limit 50) q),'[]'::jsonb),
  'outstanding_cash_collections',coalesce((select jsonb_agg(to_jsonb(q) order by q.collected_at asc) from (select cc.id,cc.order_id,o.order_number,cc.captain_user_id,cp.captain_code,cc.amount_iqd,cc.status,cc.collected_at,cc.deposit_reference,cc.notes from public.cash_collections cc join public.orders o on o.id=cc.order_id join public.captain_profiles cp on cp.user_id=cc.captain_user_id where cc.status in('collected','deposited','disputed') order by cc.collected_at asc limit 50) q),'[]'::jsonb)
 );
end; $$;
create or replace function public.get_finance_reconciliation_snapshot() returns jsonb language sql security invoker set search_path=pg_catalog,public,private as $$ select private.get_finance_reconciliation_snapshot(); $$;
revoke all on function private.get_finance_reconciliation_snapshot() from public,anon,authenticated;
revoke all on function public.get_finance_reconciliation_snapshot() from public,anon;
grant execute on function public.get_finance_reconciliation_snapshot() to authenticated;

create or replace function private.record_captain_earning_rule_audit() returns trigger language plpgsql security definer set search_path=pg_catalog,public,private as $$
begin
 insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),case when tg_op='INSERT' then 'captain_earning_rule_created' else 'captain_earning_rule_updated' end,'captain_earning_rule',coalesce(new.id,old.id),jsonb_build_object('operation',tg_op,'vendor_type',coalesce(new.vendor_type,old.vendor_type)));
 return coalesce(new,old);
end; $$;
revoke all on function private.record_captain_earning_rule_audit() from public,anon,authenticated;
drop trigger if exists captain_earning_rule_audit on public.captain_earning_rules;
create trigger captain_earning_rule_audit after insert or update on public.captain_earning_rules for each row execute function private.record_captain_earning_rule_audit();

-- Captain assignment integration: private.assign_captain_to_order resolves delivery fee from the order,
-- calculates the active captain earning rule, snapshots captain_earning_iqd, and records the pricing metadata.
-- Keep the existing public invoker wrapper unchanged.

create or replace function private.assign_captain_to_order(p_order_id uuid,p_captain_user_id uuid,p_delivery_fee_iqd numeric default 0,p_estimated_minutes integer default null,p_notes text default null)
returns public.delivery_assignments language plpgsql security definer set search_path=pg_catalog,public,private as $$
declare
 v_order public.orders%rowtype; v_captain public.captain_profiles%rowtype; v_assignment public.delivery_assignments%rowtype; v_admin uuid:=auth.uid();
 v_dropoff_lat double precision; v_dropoff_lng double precision; v_pickup_lat double precision; v_pickup_lng double precision;
 v_delivery_fee numeric; v_eta integer; v_calc jsonb; v_rule_id uuid; v_earning numeric;
begin
 if not private.has_permission('delivery.manage') then raise exception 'delivery_permission_required' using errcode='P0001'; end if;
 select * into v_order from public.orders where id=p_order_id for update;
 if not found then raise exception 'order_not_found' using errcode='P0001'; end if;
 if v_order.status in('cancelled','refunded','delivered') then raise exception 'order_not_assignable' using errcode='P0001'; end if;
 v_delivery_fee:=case when coalesce(p_delivery_fee_iqd,0)>0 then greatest(p_delivery_fee_iqd,0) else greatest(coalesce(v_order.delivery_fee_iqd,0),0) end;
 v_eta:=coalesce(p_estimated_minutes,nullif(v_order.delivery_pricing_snapshot->>'estimated_minutes','')::integer);
 select * into v_captain from public.captain_profiles where user_id=p_captain_user_id for update;
 if not found then raise exception 'captain_not_found' using errcode='P0001'; end if;
 if not v_captain.is_verified or v_captain.status in('suspended','busy') then raise exception 'captain_not_available' using errcode='P0001'; end if;
 if exists(select 1 from public.delivery_assignments da where da.captain_user_id=p_captain_user_id and da.status in('assigned','accepted','at_pickup','picked_up','out_for_delivery')) then raise exception 'captain_has_active_assignment' using errcode='P0001'; end if;
 select da.* into v_assignment from public.delivery_assignments da where da.order_id=p_order_id for update;
 if found and v_assignment.status not in('unassigned','cancelled','failed') then raise exception 'order_already_assigned' using errcode='P0001'; end if;
 v_calc:=private.calculate_captain_earning(v_delivery_fee,(select vendor_type from public.vendors where id=v_order.vendor_id));
 v_rule_id:=nullif(v_calc->>'rule_id','')::uuid;
 v_earning:=coalesce((v_calc->>'earning_iqd')::numeric,0);
 select latitude,longitude into v_pickup_lat,v_pickup_lng from public.vendors where id=v_order.vendor_id;
 select a.latitude,a.longitude into v_dropoff_lat,v_dropoff_lng from public.addresses a where a.id=(select cs.address_id from public.checkout_sessions cs where cs.id=v_order.checkout_session_id);
 if found then
   update public.delivery_assignments set captain_user_id=p_captain_user_id,assigned_by=v_admin,status='assigned',pickup_latitude=v_pickup_lat,pickup_longitude=v_pickup_lng,dropoff_latitude=v_dropoff_lat,dropoff_longitude=v_dropoff_lng,delivery_fee_iqd=v_delivery_fee,captain_earning_iqd=v_earning,estimated_minutes=v_eta,notes=p_notes,assigned_at=now(),accepted_at=null,picked_up_at=null,delivered_at=null,failure_reason=null,updated_at=now() where id=v_assignment.id returning * into v_assignment;
 else
   insert into public.delivery_assignments(order_id,captain_user_id,assigned_by,status,pickup_latitude,pickup_longitude,dropoff_latitude,dropoff_longitude,delivery_fee_iqd,captain_earning_iqd,estimated_minutes,notes,assigned_at)
   values(v_order.id,p_captain_user_id,v_admin,'assigned',v_pickup_lat,v_pickup_lng,v_dropoff_lat,v_dropoff_lng,v_delivery_fee,v_earning,v_eta,p_notes,now()) returning * into v_assignment;
 end if;
 update public.captain_profiles set status='busy',updated_at=now() where user_id=p_captain_user_id;
 update public.orders set status=case when status='placed' then 'confirmed' else status end,updated_at=now() where id=v_order.id;
 insert into public.delivery_events(assignment_id,order_id,actor_user_id,event_type,note,metadata) values(v_assignment.id,v_order.id,v_admin,'assigned',p_notes,jsonb_build_object('delivery_fee_iqd',v_delivery_fee,'captain_earning_iqd',v_earning,'earning_rule_id',v_rule_id,'estimated_minutes',v_eta));
 return v_assignment;
end; $$;
revoke all on function private.assign_captain_to_order(uuid,uuid,numeric,integer,text) from public,anon,authenticated;

-- The live database keeps public.assign_captain_to_order as the SECURITY INVOKER wrapper created in Phase 13/21.
-- Do not expose private implementation functions.

alter publication supabase_realtime add table public.captain_earnings;
