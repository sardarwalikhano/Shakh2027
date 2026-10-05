# SHAKH 2027 — Phase 15

Notifications + Support + Event Center.

## Database
- `notification_preferences`
- `platform_events`
- `notifications`
- `support_tickets`
- `support_messages`
- RLS on every exposed Phase 15 table
- authenticated-only client mutations through checked RPCs
- Realtime publication for notifications, platform events, support tickets and support messages

## Automated events
- Order status/payment state -> localized platform event + customer/vendor notification
- Payment intent status -> payment notification
- Delivery assignment changes -> customer/captain notification
- Support tickets/messages -> support notification

## Support controls
- Customers create tickets and send public messages
- Support/admin/super-admin can manage status, priority and assignment
- Internal notes are never exposed to customers
- Ticket authorization is checked server-side

## QA
- Security Advisor: 0 findings
- Phase 15 FK performance warnings: fixed
- Remaining performance advisor output is INFO `unused_index`, expected while the new database has very low traffic
