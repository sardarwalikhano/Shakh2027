# SHAKH Phase 23 — Delivery Zones + Dynamic Pricing + Dispatch Rules

## Scope
Adds server-authoritative delivery zone matching, distance-based pricing, price snapshots on orders, cart delivery quotes, and configurable dispatch rules. No seed/mock business data is inserted.

## Pricing
- city/district zone matching
- optional radius enforcement using real vendor/address coordinates
- base fee + included distance + per-km fee
- surge multiplier
- minimum/maximum fee caps
- free-delivery threshold
- ETA baseline + per-km estimate
- unconfigured system remains backward-compatible with a zero delivery fee until zones are configured
- configured but outside all active zones returns `outside_zone` and checkout blocks progression

## Checkout integration
Order INSERT/UPDATE delivery pricing is enforced in a trigger and checkout-session totals are synchronized from order totals. Pricing snapshot is stored in `orders.delivery_pricing_snapshot`; shipping latitude/longitude and zone metadata are stored on the order.

## Dispatch rules
Rules can constrain captain recommendation by vehicle type, maximum pickup distance, GPS freshness, and whether GPS is mandatory.

## Frontend
- checkout delivery step requests a live server quote for the selected address
- operations get a Delivery Engine page for zone and dispatch-rule management
- all business pricing remains in Supabase; client numbers are preview-only
