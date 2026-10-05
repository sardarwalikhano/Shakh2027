-- SHAKH Phase 21 performance hardening
-- Remove duplicate delivery assignment indexes introduced during dispatch-board iteration.

drop index if exists public.idx_delivery_assignments_captain_status_updated;
drop index if exists public.idx_delivery_assignments_status_updated;
