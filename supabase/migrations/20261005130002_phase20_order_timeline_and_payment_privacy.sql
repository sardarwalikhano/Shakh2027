-- SHAKH 2027 Phase 20 — order timeline and payment privacy hardening
create index if not exists idx_orders_vendor_status_created on public.orders(vendor_id,status,created_at desc);
create index if not exists idx_orders_buyer_created on public.orders(buyer_user_id,created_at desc);
create index if not exists idx_order_status_history_order_created on public.order_status_history(order_id,created_at desc);
-- Live function definitions are already applied in the remote project and documented in Phase 20 verification.
