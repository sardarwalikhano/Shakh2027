# SHAKH Phase 24 — Captain Earnings + Finance Reconciliation

Phase 24 connects delivered delivery assignments to captain earnings, captain wallets, withdrawals, COD collection visibility and finance reconciliation.

## Backend

- `captain_earning_rules` stores configurable earning rules by vendor type, rate (bps), fixed amount, min/max, effective window and priority.
- `captain_earnings` stores one immutable earning record per delivery assignment with an idempotency key and optional wallet-ledger reference.
- `private.assign_captain_to_order` resolves the current delivery fee and active earning rule and snapshots `captain_earning_iqd` on the assignment.
- `private.settle_captain_earning` is invoked exactly once when an assignment changes to `delivered` and credits the captain wallet through the existing append-only wallet ledger.
- `get_captain_finance_snapshot` returns captain wallet, lifetime/30-day earnings, delivery count, COD outstanding and recent earning records.
- `get_finance_reconciliation_snapshot` exposes finance-level captain earning, ledger, COD, withdrawal and payout reconciliation metrics.
- `reconcile_cash_collection` remains the authoritative COD reconciliation mutation.

## Security

Public RPCs are `SECURITY INVOKER`. Sensitive implementation functions remain in the private schema and are not executable by `anon` or `authenticated` directly. Captain earnings are readable by the owning captain or finance readers; earning-rule configuration is restricted to finance managers.

## Important business rule

No earning rate is seeded. Until a finance manager creates an active `captain_earning_rules` row, a newly assigned delivery snapshots captain earning as `0`. This avoids inventing a financial policy in the database.

## Frontend

- Captain Finance panel shows lifetime earnings, last-30-day earnings, delivery count and COD outstanding.
- Finance Center shows captain reconciliation metrics, recent captain earnings, COD collection queue and a global earning-rule configuration control.
- Existing wallet, withdrawal, COD and delivery workflows are preserved.

## Verification

- Security Advisor: 0 findings after Phase 24 changes.
- Performance Advisor is expected to report only unused-index INFO on the new/low-traffic database after FK indexes are present.
- TypeScript source parse is checked separately because the local environment may not have installed React/Supabase packages.
