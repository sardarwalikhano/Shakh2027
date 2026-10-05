# SHAKH 2027 — Phase 20
## Vendor Orders + Fulfillment + Customer Order Details

Phase 20 connects the order lifecycle to the existing cart, payment, delivery, notification, finance, and RBAC layers.

### Backend

- `list_customer_orders(status, limit)` returns the signed-in user's order summaries.
- `get_order_details(order_id)` returns order, items, status history, latest delivery assignment, and payment summary only to the customer, vendor owner, delivery captain, or authorized operations staff.
- `list_vendor_orders(vendor_id, status, limit)` returns vendor-owned orders with buyer/fulfillment context.
- `update_vendor_order_status(order_id, next_status, note)` enforces the vendor fulfillment state machine.
- Vendor state machine: `placed -> confirmed -> processing -> ready_for_pickup`.
- Vendor cancellation is only allowed from `placed`, `confirmed`, or `processing`, and is blocked when an active delivery assignment exists.
- `mobile_cash` orders cannot be confirmed until payment is marked `paid`.
- `order_status_history` is now automatically populated on order creation and every order status change.
- Existing Delivery state machine remains authoritative after `ready_for_pickup`: captain assignment/acceptance/pickup/out-for-delivery/delivered continue through Phase 13 RPCs.
- Added `orders(vendor_id,status,created_at)` and related lookup indexes.
- Order read/manage permissions are aligned for all vendor roles, plus support/captain-manager read access.

### Frontend

- Customer `Orders` section now loads from the server RPC instead of a direct placeholder listing.
- Customer can select an order and view its items, totals, payment state, delivery state, address, and timeline.
- Active delivery exposes the existing live tracking route.
- Vendor Center now includes a fulfillment panel with status filtering and server-enforced actions.
- No business data is stored in localStorage/sessionStorage.

### Security

- Public wrappers use `SECURITY INVOKER`.
- Privileged implementations live in `private` and are protected by `auth.uid()`/permission/ownership checks.
- Customer payment provider reference is hidden from the customer response.
- Existing RLS and table grants remain restrictive; anonymous users have no direct order table access.
