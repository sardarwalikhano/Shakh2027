# SHAKH 2027 — Phase 11: Real Cart + Order System

## Scope
This phase moves Cart and Checkout from UI-only flow to a real Supabase-backed transaction boundary.

## Implemented
- Real `cart_items` reads and quantity management
- Atomic `add_variant_to_cart` RPC with stock validation
- Atomic `set_cart_item_quantity` RPC with stock validation
- `checkout_sessions` for checkout-level idempotency and address snapshot
- `orders` split by vendor from one checkout session
- `order_items` with immutable product/variant name and price snapshots
- Inventory reservation via `reserved_quantity`
- `order_status_history` with automatic status-event trigger
- Server-side subtotal/total calculation
- Idempotency-key protection against duplicate checkout submissions
- RLS for customer/vendor/admin order visibility
- Direct client insert/update/delete access to orders is not granted

## Payment boundary
Phase 11 implements only Cash on Delivery as a fully executable payment method.
Wallet and Mobile Cash remain represented in the UI contract but are intentionally disabled until the finance/payment phases implement server-side authorization, ledger mutation and provider webhook confirmation.

## Delivery boundary
The current standard delivery UI option has no persisted fee calculation yet. `delivery_fee_iqd` remains server-owned and is `0` until the dedicated Delivery Engine phase supplies a verified value.

## Integrity rule
The browser does not determine the final order price or stock availability. Those values are recalculated and reserved by PostgreSQL inside the checkout transaction.
