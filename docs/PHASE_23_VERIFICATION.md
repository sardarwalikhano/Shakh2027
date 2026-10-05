# SHAKH — Phase 23 Verification

Date: 2026-10-05

## Scope

Delivery Zones, server-side dynamic delivery pricing, cart delivery quotes, checkout delivery-fee snapshots, dispatch rules, GPS-aware captain recommendation, and delivery pricing administration.

## Live Supabase

Project: `gnfzqctnqplovfzbfsxp`

The live database contains the Phase 23 objects and hardening migrations. No seed/mock delivery zones were inserted.

## Security

- Supabase Security Advisor: **0 findings**.
- Delivery zone / dispatch rule tables use RLS.
- Direct config reads/writes require `delivery.manage`.
- Public application RPCs are SECURITY INVOKER.
- Private privileged implementations remain non-executable by `anon` and `authenticated`.
- No `delivery.manage` permission is granted to the `captain` role.

## Pricing integrity

- Delivery fee is computed server-side.
- Quote uses city/district and optional real latitude/longitude radius checks.
- Fee supports base fee, included distance, per-km fee, surge multiplier, min/max caps, and free-delivery threshold.
- Order rows persist zone, distance, pricing status, and pricing snapshot.
- Checkout session totals are re-derived from persisted order totals so delivery fee cannot be overwritten by a legacy checkout finalization update.
- A temporary live test zone was inserted inside a transaction and rolled back; no test data persisted.

## Dispatch intelligence

Captain recommendations enforce the active dispatch rule for vehicle type, pickup distance, GPS freshness, GPS requirement, and minimum SLA remaining time. Ranking uses real captain GPS when available.

## Static/mock storage QA

`localStorage` / `sessionStorage` occurrences: **0**.

No static JSON business dataset was introduced.

## Source QA

The repository source contains **86** TS/TSX files. Parser/transpile verification can run without project dependencies; full typecheck/build is blocked in this environment because `node_modules` is incomplete. `npm install --ignore-scripts --no-audit --no-fund` timed out.

## Performance

Performance Advisor reports only `unused_index` INFO notices in this new/low-traffic database. The Phase 23 unindexed foreign keys (`delivery_zones.created_by`, `dispatch_rules.created_by`) were fixed with covering indexes. No duplicate-index finding remains.

## Known deployment constraint

GitHub connector writes to `sardarwalikhano/Shakh2027` still return `403 Resource not accessible by integration`. No push/deployment success is claimed.
