# SHAKH Phase 21 — Dispatch Board

## Scope
Captain operations, dispatch-board management, assignment reassignment/release and realtime synchronization.

## Backend
- `private.get_dispatch_board(integer)` + public SECURITY INVOKER wrapper.
- `private.release_delivery_assignment(uuid,text)` + public wrapper.
- `private.reassign_delivery_assignment(uuid,uuid,text)` + public wrapper.
- Dispatch operations gated by `delivery.manage`.
- `captain` no longer receives `delivery.manage`.
- Realtime publication includes captain profiles, orders and delivery events in addition to existing delivery assignment/location tables.

## Dispatch data
The board returns live queue metrics, active/unassigned orders, assignment details, captain status, current active assignment and last known location age. No mock coordinates or seeded operational data are introduced.

## Frontend
- `DispatchConsole` is a full operational board with filters for all/unassigned/active orders.
- Selected-order panel supports assignment, reassignment and release.
- Captain roster shows availability, active order and GPS freshness.
- Existing Captain Console and Tracking Console remain intact.
