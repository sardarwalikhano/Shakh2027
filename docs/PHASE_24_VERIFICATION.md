# Phase 24 Verification

## Database

- Confirm Phase 24 migrations in Supabase migration history.
- Confirm `captain_earning_rules`, `captain_earnings` exist and have RLS enabled.
- Confirm captain earning public RPC is invoker-only.
- Confirm private settlement functions are not executable by `anon`/`authenticated`.
- Confirm delivered assignment trigger calls captain earning settlement.
- Confirm `captain_earnings.ledger_entry_id` FK is indexed.

## Reconciliation checks

1. Create an earning rule in Finance Center.
2. Assign a captain to a new delivery.
3. Confirm `delivery_assignments.captain_earning_iqd` contains the rule-derived snapshot.
4. Complete the delivery.
5. Confirm one `captain_earnings` row exists for the assignment.
6. Confirm the captain wallet receives exactly one matching ledger credit.
7. Retry/read the captain finance snapshot; totals must remain idempotent.
8. COD collection remains independent and is reconciled through the existing `reconcile_cash_collection` RPC.

## Source QA

- Parse all `.ts`/`.tsx` files with TypeScript source parsing.
- Search for `localStorage` and `sessionStorage`; expected count: 0.
- Run `npm run build` after installing package dependencies in a networked build environment.
