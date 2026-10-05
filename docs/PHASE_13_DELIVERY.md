# SHAKH 2027 — Phase 13 Delivery

## Backend
- captain_profiles
- delivery_assignments
- captain_live_locations (latest location only)
- delivery_location_events (history)
- delivery_events (operational audit trail)
- vendor pickup coordinates
- assignment status state machine
- captain availability state machine
- server-side captain location ingest with throttling
- order status synchronization
- inventory finalization on delivered/cancelled

## Realtime
`captain_live_locations` and `delivery_assignments` are added to `supabase_realtime`.
Client uses Postgres Changes with RLS. Supabase notes that each table must be in the realtime publication and that RLS still controls whether a client receives the changed row.

For larger fleets, move high-frequency location fan-out to private Realtime Broadcast while keeping Postgres as the source of truth.

## Privacy
- Customer sees tracking only for their own order.
- Captain sees their own assignment/location.
- Delivery operations can access operational tracking.
- Raw location history is not exposed to customers.
- Vehicle plate is not returned by the customer tracking RPC.

## UI
- Captain Console
- Availability toggle
- Assignment accept/reject
- Delivery state progression
- Browser Geolocation integration
- Customer live tracking view
- Realtime refresh
- Delivery status surfaces
- Map abstraction without locking the product to a specific provider
