# SHAKH 2027 — UI/UX Phase 07

## Role dashboards & operations

This phase introduces a shared operations shell for:
- super_admin
- admin
- vendor
- captain
- captain_manager
- support

### UX rules
- One shell, role-aware module registry.
- Navigation is permission-aware at the data contract level.
- No fake KPI values or business records.
- Empty/data states explicitly point to Supabase as the source of truth.
- Responsive dashboard layout: sidebar on desktop, compact content flow on mobile.
- Dense operational UI inspired by modern SaaS admin products, without copying a specific product.

### Security boundary
The visible role selector is a UI preview only. Production authorization must resolve the authenticated user's roles/permissions from the Supabase database and RLS. Client-side visibility must never be treated as authorization.

### Next phase
Final UX system hardening: global states, accessibility, responsive QA, motion, error/loading patterns and release-level visual consistency.
