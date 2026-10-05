# Phase 10 — Real Commerce Database + Catalog

## Delivered
- `categories`
- `vendors`
- `products`
- `product_images`
- `product_variants`
- `inventory`
- `addresses`
- `cart_items`
- Vendor-aware RLS and catalog management policies.
- Public active catalog read boundary.
- Customer-owned address/cart boundary.
- Product stock signal derived from inventory.
- Supabase-backed Marketplace query service.

## Data flow
Supabase PostgreSQL → `src/features/commerce/catalogApi.ts` → Marketplace UI.

No mock catalog data is inserted. When the database is empty, the UI renders its empty/skeleton states.

## Security
The Security Advisor was run after the phase changes and returned zero security findings.

## Note
Search is currently limited to the first 100 active products and normalized client-side.
Full-text search/indexing is intentionally deferred to the search-hardening phase.
