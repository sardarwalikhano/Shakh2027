# SHAKH 2027 — Phase 14 Verification

Date: 2026-10-05

## Live Supabase

Project: `gnfzqctnqplovfzbfsxp`

Security Advisor: **0 findings** after the final hardening pass.

Performance Advisor: only informational `unused_index` entries remain in the low/no-traffic project. New payment/cash foreign-key indexes were added; no new unindexed-FK lint remains.

Realtime publication contains:
- `payment_intents`
- `captain_live_locations`
- `delivery_assignments`

Payment RPC privilege boundary:
- `process_mobile_cash_webhook`: `anon=false`, `authenticated=false`, `service_role=true`
- customer-facing checkout/payment RPCs: `anon=false`, `authenticated=true`

## Payment safety

- Payment transactions are immutable.
- Payment intent idempotency is enforced.
- Provider webhook event idempotency is enforced.
- Mobile Cash webhook requires HMAC-SHA256 signature verification in the Edge Function.
- Webhook event is bound to both `checkout_session_id` and `payment_intent_id` to prevent stale retry events from settling a newer intent.
- Exact IQD amount is verified before a Mobile Cash payment can become `paid`.
- Wallet debit uses the existing atomic Phase 12 wallet ledger.
- COD collection is recorded separately and supports reconciliation states.

## Source QA

- 65 `.ts` / `.tsx` files parsed with TypeScript AST parser.
- Parse diagnostics: **0**.
- `localStorage` / `sessionStorage` references in `src`: **0**.
- `mobile-cash-webhook` deployed ACTIVE at Edge Function version 3.

## Known limitations

A real Mobile Cash provider account/credentials and provider-specific request/response contract have not been supplied, so the provider handoff remains intentionally adapter-neutral. The signed webhook gateway is production-structured but should not be declared live with a provider until its real secret and API contract are configured and tested.

The local environment does not contain the installed React/Supabase package set required for a full `npm run build`; the source parser is clean, but a full dependency-backed build must be run in the normal development/CI environment.

GitHub write access to `sardarwalikhano/Shakh2027` remains blocked by the connector with HTTP 403, so no push is claimed.
