# SHAKH 2027 — Phase 16

## Admin Operations Center + Advanced Dashboard + Audit Console

Phase 16 replaces the dashboard placeholders with a real Supabase-backed operations snapshot.

### Live database capabilities
- `get_operations_dashboard_snapshot()` — permission-aware JSON snapshot for KPI and queues.
- `get_audit_console()` — Super Admin audit-log console API with action/entity filters.
- Baghdad/Erbil local-day KPI calculation using `Asia/Baghdad` before UTC comparison.
- Order, payment, delivery, finance, user, and support metrics are returned only when the caller has the corresponding backend permission.
- Recent orders/events/support queues come from live Supabase tables; no mock records or browser storage.

### UI
- Dashboard KPI cards use live snapshot values.
- Quick actions link to Delivery, Payments, Support, and Audit.
- Workspace role switcher is limited to roles actually held by the signed-in user.
- Super Admin-only Audit Console with filters and immutable-view presentation.
- Added `RequirePermission` guard for privilege-specific routes.
- Added missing `src/main.tsx` entrypoint required by `index.html`.

### Security
- `get_operations_dashboard_snapshot` and `get_audit_console` run as `SECURITY DEFINER`, but gate access through `private.has_permission`.
- Public wrappers are invoker functions and anonymous execution is revoked.
- Audit console requires `platform.manage`.
- Existing RLS remains the source of truth for direct table access.
