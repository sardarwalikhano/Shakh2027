# SHAKH Phase 22 — Captain Mobile Operations + SLA / ETA + Dispatch Intelligence

## Scope
Phase 22 strengthens the existing Captain Console and Dispatch Board without removing prior delivery, tracking, order-management, or dispatch functionality.

## Backend
- Added `private.get_delivery_sla(...)` as the server-side baseline SLA/ETA calculator.
- Added `get_dispatch_captain_recommendations(uuid, integer)` to rank verified available captains by real pickup distance when live coordinates exist.
- Added `get_captain_mobile_snapshot(uuid)` for a captain-scoped mobile view containing profile, live location, active delivery, customer contact/shipping context, pending assignments, recent assignments, and SLA state.
- Public RPCs are `SECURITY INVOKER`; privileged implementation functions stay in `private` and are not executable by `anon`/`authenticated`.
- Existing `delivery.manage` authorization remains operations-only; the `captain` role does not receive it.

## SLA baseline
The baseline advisory windows are intentionally explicit and deterministic:
- Unassigned / failed / cancelled dispatch queue: 10 minutes from order creation.
- Assigned and awaiting captain response: 3 minutes from assignment.
- Accepted / at-pickup: 20 minutes from acceptance.
- Picked-up / out-for-delivery: `estimated_minutes` from pickup when an ETA exists.

The function classifies work as `on_track`, `at_risk` (5 minutes or less remaining), `overdue`, or `not_available`.

## Dispatch intelligence
Recommendations use the actual vendor pickup coordinates and each available captain's latest live coordinates. No synthetic locations, seeded captains, mock distances, or route assumptions are introduced.

## Frontend
- Captain Console now surfaces GPS heartbeat state and last successful location submission.
- Captain Console surfaces mobile SLA state, remaining ETA, next action, customer phone link, and shipping context.
- Dispatch Board surfaces SLA risk/overdue counts, order age, remaining SLA time, and risk chips.
- Dispatch Board surfaces ranked nearby/available captain recommendations with distance and GPS freshness.
- Existing assignment/reassignment/release controls remain intact.
- Existing customer tracking and live order status flows remain intact.

## Security verification
- Security Advisor: 0 findings after Phase 22 changes.
- Public Phase 22 RPCs: `anon` execute = false, `authenticated` execute = true.
- Private Phase 22 helper/snapshot/recommendation functions: not directly executable by public roles.

## Performance verification
Performance Advisor reports only the existing `unused_index` informational notices on this new, low-traffic database. No new duplicate-index warning remains.

## Source QA
- 83 TypeScript / TSX source files transpile with 0 diagnostics using the installed TypeScript parser.
- `localStorage` / `sessionStorage` occurrences remain 0.
- Full `npm run build` remains blocked in this container because the repository's `node_modules` does not contain the pinned React / Supabase dependencies. This is an environment dependency-install issue, not a Phase 22 parser failure.
