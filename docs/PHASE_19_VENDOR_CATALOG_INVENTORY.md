# SHAKH 2027 — Phase 19

## Vendor Center + Product / Inventory Management

Phase 19 adds a production-oriented Vendor Center on top of the existing Supabase commerce catalog.

### Live capabilities

- Vendor Center snapshot with product, active, low-stock and out-of-stock KPIs.
- Vendor selector for users who can manage multiple stores.
- Live product listing with status and primary-variant inventory information.
- Atomic vendor product creation: product + default variant + inventory are created in one database transaction.
- Server-side validation for slug, multilingual names, price and inventory values.
- Vendor-owner publishing requires an active and verified vendor; catalog managers can manage platform-wide catalog records.
- Inventory updates are locked server-side and cannot reduce total quantity below reserved stock.
- Product status transitions are permission checked in the backend.
- Existing product stock synchronization remains active through the Phase 10 stock trigger.
- No mock catalog data, static business JSON or localStorage business state was introduced.

### Security model

Public RPCs are SECURITY INVOKER wrappers. Privileged database work stays in the private schema with SECURITY DEFINER implementations and explicit authentication/ownership checks.

The existing catalog RLS policies remain the final row-level boundary for direct table access.
