# SHAKH 2027 — Phase 17 Verification

## Source QA
- TypeScript/TSX files parsed: 77
- Parse diagnostics: 0
- `localStorage` / `sessionStorage` occurrences in `src`: 0
- `paymentApi.ts` keeps `p_coupon_code` only on checkout initialization, not on standalone payment-intent creation.

## Supabase QA
- PGroonga installed in `extensions`.
- `global_search(...)` executes successfully against the live project and returns the real catalog shape; the database currently has no catalog rows, so an empty result is expected.
- `list_active_promotions()` executes successfully and currently returns an empty items array because no promotion records have been seeded.
- Promotion/coupon/analytics tables have RLS enabled.
- Promotion/coupon operational tables are not directly granted to `anon`/`authenticated`; RPCs are the controlled access boundary.
- Public checkout RPCs retain both the original 3-argument signature and the new 4-argument coupon signature.
- Coupon-redemption rows are immutable through an update/delete trigger.
- `Security Advisor`: 0 findings after final Phase 17 hardening.
- `Performance Advisor`: no unindexed-FK findings after hardening; it still reports unused-index INFO findings (currently 95) because this is a new/low-traffic database.

## Build boundary
A full `npm run build` can only be considered successful once the runtime/CI installs the declared React and Supabase dependencies. Earlier local execution in this environment reported module-resolution errors because those packages were absent from the runtime `node_modules`; the source parser remained clean.

## Git boundary
GitHub Contents API writes to `sardarwalikhano/Shakh2027` remain blocked by the connector with HTTP 403. No successful push is claimed.
