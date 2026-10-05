-- SHAKH 2027 — Phase 12 Finance & Wallet
-- Core wallet/ledger/commission/withdrawal/payout/refund foundation.
-- Privileged money movement is isolated in private schema functions.

create table if not exists public.wallets (
  id uuid primary key default gen_random_uuid(),
  wallet_type text not null check (wallet_type in ('customer','vendor','captain','platform')),
  owner_user_id uuid references public.profiles(id) on delete restrict,
  owner_vendor_id uuid references public.vendors(id) on delete restrict,
  currency text not null default 'IQD' check (currency = 'IQD'),
  balance_iqd numeric(14,2) not null default 0 check (balance_iqd >= 0),
  status text not null default 'active' check (status in ('active','frozen','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wallet_owner_shape check (
    (wallet_type in ('customer','captain') and owner_user_id is not null and owner_vendor_id is null)
    or (wallet_type = 'vendor' and owner_user_id is null and owner_vendor_id is not null)
    or (wallet_type = 'platform' and owner_user_id is null and owner_vendor_id is null)
  )
);

create unique index if not exists one_customer_wallet_per_user on public.wallets(owner_user_id) where wallet_type='customer';
create unique index if not exists one_captain_wallet_per_user on public.wallets(owner_user_id) where wallet_type='captain';
create unique index if not exists one_vendor_wallet_per_vendor on public.wallets(owner_vendor_id) where wallet_type='vendor';
create unique index if not exists one_platform_wallet on public.wallets(wallet_type) where wallet_type='platform';

create table if not exists public.wallet_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  direction text not null check (direction in ('credit','debit')),
  entry_type text not null check (entry_type in ('funding','order_settlement','commission','refund','withdrawal_hold','withdrawal_reversal','payout_adjustment','manual_adjustment')),
  amount_iqd numeric(14,2) not null check (amount_iqd > 0),
  balance_before_iqd numeric(14,2) not null check (balance_before_iqd >= 0),
  balance_after_iqd numeric(14,2) not null check (balance_after_iqd >= 0),
  reference_type text,
  reference_id uuid,
  idempotency_key text not null,
  description text,
  created_at timestamptz not null default now(),
  unique(wallet_id, idempotency_key),
  constraint wallet_ledger_balance_consistency check (
    (direction='credit' and balance_after_iqd=balance_before_iqd+amount_iqd)
    or (direction='debit' and balance_after_iqd=balance_before_iqd-amount_iqd)
  )
);

create table if not exists public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  vendor_type text check (vendor_type is null or vendor_type in ('restaurant','supermarket','fashion','car','umrah','beauty','general')),
  base_type text not null default 'subtotal' check (base_type in ('subtotal','total')),
  rate_bps integer not null check (rate_bps between 0 and 10000),
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create table if not exists public.order_financials (
  order_id uuid primary key references public.orders(id) on delete restrict,
  vendor_wallet_id uuid not null references public.wallets(id) on delete restrict,
  platform_wallet_id uuid not null references public.wallets(id) on delete restrict,
  gross_iqd numeric(14,2) not null check(gross_iqd>=0),
  delivery_fee_iqd numeric(14,2) not null check(delivery_fee_iqd>=0),
  commission_rate_bps integer not null check(commission_rate_bps between 0 and 10000),
  commission_iqd numeric(14,2) not null check(commission_iqd>=0),
  vendor_net_iqd numeric(14,2) not null check(vendor_net_iqd>=0),
  refunded_iqd numeric(14,2) not null default 0 check(refunded_iqd>=0),
  settled_at timestamptz not null default now(),
  settlement_idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint order_financial_total check(commission_iqd+vendor_net_iqd=gross_iqd)
);

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  amount_iqd numeric(14,2) not null check(amount_iqd>0),
  status text not null default 'requested' check(status in ('requested','approved','processing','paid','rejected','failed','cancelled')),
  idempotency_key text not null,
  reason text,
  rejection_reason text,
  failure_reason text,
  processed_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(wallet_id,idempotency_key)
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null unique references public.withdrawals(id) on delete restrict,
  wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount_iqd numeric(14,2) not null check(amount_iqd>0),
  provider text,
  provider_reference text,
  status text not null default 'queued' check(status in ('queued','processing','paid','failed')),
  failure_reason text,
  processed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  customer_wallet_id uuid not null references public.wallets(id) on delete restrict,
  amount_iqd numeric(14,2) not null check(amount_iqd>0),
  method text not null default 'wallet' check(method='wallet'),
  status text not null default 'requested' check(status in ('requested','approved','processed','rejected')),
  reason text,
  idempotency_key text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  processed_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(order_id,idempotency_key)
);

-- The live project also contains private security-definer money movement functions,
-- narrow invoker RPC wrappers, ownership RLS policies, least-privilege grants,
-- signup/vendor/captain wallet creation triggers, and wallet/profile synchronization.
-- Those portions are applied in the live project in the Phase 12 hardening migrations.
