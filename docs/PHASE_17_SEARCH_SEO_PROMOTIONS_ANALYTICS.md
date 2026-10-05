# SHAKH 2027 — Phase 17
## Search + SEO + Promotions + Coupons + Analytics

Phase 17 adds production data paths for marketplace discovery, server-owned discount rules, coupon validation, checkout discount calculation, and platform analytics.

### Search + SEO
- PGroonga is enabled in the `extensions` schema for multilingual keyword search.
- `products`, `vendors`, and `categories` expose generated `search_text` columns with PGroonga indexes.
- `global_search(...)` searches active products, vendors, and categories while existing RLS remains the read boundary.
- Product/vendor/category SEO title and description fields were added without replacing existing fields.
- The marketplace updates document title, description, and canonical URL from real catalog data.

### Promotions + Coupons
- `promotions` supports automatic or coupon campaigns, percentage or fixed discounts, maximum discounts, minimum subtotal, vendor/category scope, schedule, priority, usage caps, and per-user limits.
- `coupon_codes` stores reusable codes under a promotion.
- `coupon_redemptions` is immutable and records the server-calculated discount for a checkout session.
- Direct table access for promotion/coupon operational data is revoked from `anon`/`authenticated`; clients use permission-gated RPCs.
- `validate_coupon` returns the server-side decision and discount preview for an authenticated buyer.
- Checkout accepts an optional coupon code through a 4-argument RPC while retaining the original 3-argument RPC contracts for backward compatibility.
- The checkout transaction locks cart lines plus the coupon/promotion row, recalculates eligibility and prices server-side, allocates discounts across multi-vendor orders, and stores the final discount and total in both the checkout session and orders.
- Finance settlement already uses `orders.total_iqd` for total-based commission rules, so the applied discount flows into downstream settlement.

### Analytics
- `analytics_events` is an append-only event stream; no business analytics data is stored in browser storage.
- `record_analytics_event` supports anonymous and authenticated event capture with bounded text fields and JSON object properties.
- Server-generated order/payment/delivery lifecycle events are emitted from the orders trigger.
- Coupon redemption emits `coupon_redeemed`.
- `get_analytics_overview(days)` returns server-aggregated activity, paid revenue, top events, and conversion funnel metrics and is permission-gated.
- Admin pages use live Supabase RPCs only; no mock KPI values are introduced.

### Frontend surfaces
- Marketplace search calls `global_search` when a query is present.
- Marketplace records `product_view` and `add_to_cart` events without blocking the commerce action if analytics capture fails.
- Checkout provides a coupon input and server validation preview.
- Admin dashboard routes: `#analytics` and `#promotions` with permission guards.
- Dashboard role module registry exposes Analytics and Promotions to `super_admin` and `admin`.

### Security boundary
Supabase remains the source of truth. Public wrappers are `SECURITY INVOKER`; privileged implementations live in the private schema and require explicit permission checks. No service-role credential is added to the frontend.

### Known operational caveat
Coupon usage is reserved at checkout-session creation. If a later external mobile-cash payment fails, the current Phase 17 implementation does not release that coupon usage automatically. This is intentionally isolated for a later payment/refund hardening phase rather than weakening the atomic checkout transaction.
