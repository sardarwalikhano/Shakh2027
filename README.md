# SHAKH 2027 — شاخ

Kurdish-first, mobile-first marketplace and delivery platform built with React + TypeScript + Vite + Tailwind CSS and Supabase.

## Completed phases
- Phase 09 — Auth + RBAC
- Phase 10 — Commerce Catalog
- Phase 11 — Cart + Atomic Checkout + Orders
- Phase 12 — Finance + Wallet
- Phase 13 — Delivery + Captain + Live Tracking
- Phase 14 — Payments + Webhooks
- Phase 15 — Notifications + Support + Event Center
- Phase 16 — Admin Operations Center + Audit Console
- Phase 17 — Search + SEO + Promotions + Coupons + Analytics
- Phase 18 — Reviews + Ratings + Favorites + Customer Experience
- Phase 19 — Vendor Center + Product / Inventory Management
- Phase 20 — Order Management + Fulfillment + Customer Order Details
- Phase 21 — Captain Operations + Dispatch Board + Realtime Assignment Management
- Phase 22 — Captain Mobile Operations + SLA/ETA + Dispatch Intelligence
- Phase 23 — Delivery Zones + Dynamic Pricing + Advanced Dispatch Rules
- Phase 24 — Captain Earnings + Finance Reconciliation
- Phase 25 — Financial Disputes + Chargebacks + Reconciliation/Audit Hardening

Supabase is the source of truth. Business data is not stored in localStorage/sessionStorage.

## Phase 16 — Admin Operations Center

Live Supabase-backed operational dashboard, permission-aware KPI snapshot, and Super Admin audit console are included. See `docs/PHASE_16_ADMIN_OPERATIONS.md` and `docs/PHASE_17_SEARCH_SEO_PROMOTIONS_ANALYTICS.md`.

## Phase 18 — Reviews + Favorites
Live Supabase-backed wishlist state, verified-purchase reviews, and trigger-driven product rating aggregation. See `docs/PHASE_18_REVIEWS_FAVORITES_CUSTOMER_EXPERIENCE.md`.


## Phase 19 — Vendor Center + Product / Inventory

Live vendor catalog management, atomic product creation, stock controls, publishing rules, and backend permission enforcement.

## Phase 20 — Order Management & Fulfillment

Phase 20 adds server-enforced vendor fulfillment workflows, customer order detail/timeline, delivery visibility, role-aligned order permissions, and automatic order status history.
See `docs/PHASE_20_ORDER_MANAGEMENT.md` and `docs/PHASE_20_VERIFICATION.md`.
## Phase 21 — Captain Operations + Dispatch Board + Realtime Assignment Management

- Added a server-authoritative dispatch board RPC with queue, assignment, captain roster and live-location summaries.
- Added operations-only release/reassignment workflows with transactional locking.
- Removed `delivery.manage` from the `captain` role so captain actions remain limited to their own delivery workflow.
- Extended Realtime publication for `captain_profiles`, `orders`, and `delivery_events` while preserving existing delivery tracking tables.
- Added a responsive Dispatch UI with filters, selected-order detail, captain selection/reassignment, release action, live state and captain roster.
- Preserved the existing Captain Console and customer tracking flow.
- Final backend verification: Security Advisor 0 findings; performance duplicate-index warnings resolved.

## Phase 22 — Captain Mobile Operations + SLA / ETA

Phase 22 adds server-side SLA/ETA classification, captain mobile snapshots, real-coordinate captain recommendations, GPS heartbeat visibility, and dispatch SLA risk indicators without removing prior delivery functionality. See `docs/PHASE_22_CAPTAIN_MOBILE_SLA_ETA.md`.


## Phase 23 — Delivery Zones + Dynamic Pricing + Dispatch Rules
- Server-authoritative Delivery Zone matching and distance-based delivery pricing.
- Order pricing snapshots with zone/distance/fee metadata and checkout-session total synchronization.
- Live checkout delivery quote from Supabase.
- Operations UI for Delivery Zones and Advanced Dispatch Rules.
- Dispatch recommendations respect vehicle, distance, GPS freshness, and SLA rules.

## Phase 23 — Delivery Zones + Dynamic Pricing + Dispatch Rules

- Added server-side delivery zones, distance pricing, surge, caps, free-delivery threshold, and ETA calculation.
- Added checkout delivery-fee snapshots and session-total integrity guard.
- Added dispatch rules for vehicle type, GPS freshness, pickup distance, and SLA constraints.
- Added secure delivery pricing administration and audit logging.
- Kept Supabase as the source of truth; no mock delivery pricing data.

## Phase 24 — Captain Earnings + Finance Reconciliation

Phase 24 adds configurable captain earning rules, one-record-per-delivery earning settlement, captain wallet ledger credits on delivered assignments, captain finance snapshots, and finance reconciliation for captain earnings/COD/payout queues. No earning rate is seeded; finance managers configure it explicitly.


## Phase 25 — Financial Disputes + Reconciliation

Phase 25 adds chargeback/dispute tracking, refund provider metadata and audit coverage, server-authoritative dispute state transitions, and reconciliation anomaly detection across refunds, wallet ledger, captain earnings, payouts and payment/order state. No provider credentials or fake provider events are seeded. See `docs/PHASE_25_FINANCIAL_DISPUTES_RECONCILIATION.md` and `docs/PHASE_25_VERIFICATION.md`.

## Phase 26 — Cars + Umrah booking-only + Role Accounts + PWA

Phase 26 adds an authenticated-user SHAKH Cars marketplace where every user can publish a vehicle through a paid listing flow, while professional `car_dealer` accounts remain available. The car listing fee is configurable by Finance and is not arbitrarily seeded.

Umrah is explicitly booking-only: customers pay exactly 2,000 IQD to reserve a package; the package purchase price is informational and is not collected by SHAKH in this flow. Approved `umrah_agency` accounts can create package drafts.

Professional role accounts are activated through a Supabase-backed role application workflow. `admin` and `super_admin` are protected from self-escalation.

The web app is also installable as a PWA with manifest, service worker, offline fallback, responsive mobile/tablet/desktop UI, and the SHAKH logo at `public/brand/shakh-logo.jpg`.

See `docs/PHASE_26_CARS_UMRAH_ROLE_ACCOUNTS.md` and `docs/PHASE_26_VERIFICATION.md`.
