# SHAKH 2027 — Phase 14 Payments

## Live Supabase implementation

Payment foundations are implemented in the new SHAKH Supabase project:

- `payment_intents` — customer payment intent state and provider references.
- `payment_transactions` — immutable payment transaction records.
- `payment_webhook_events` — idempotent inbound webhook processing records; not exposed to client roles.
- `cash_collections` — COD collection and reconciliation trail.
- Wallet payment uses the Phase 12 wallet ledger with a `payment` debit.
- Checkout + payment initialization is atomic through `checkout_and_initialize_payment`.
- Supported checkout methods: `cash_on_delivery`, `wallet`, `mobile_cash`.
- Mobile Cash success requires a signed webhook, exact IQD amount match, and an exact checkout-session + payment-intent binding.
- Mobile Cash retry is supported for failed/cancelled/expired intents.
- `payment_intents` are enabled for Supabase Realtime.

## Edge Function

`supabase/functions/mobile-cash-webhook/index.ts` is deployed as `mobile-cash-webhook`.

The function uses HMAC-SHA256 with the `MOBILE_CASH_WEBHOOK_SECRET` secret and requires:

- `x-shakh-signature`
- `x-shakh-event-id`
- matching `event_id` in JSON

The provider-specific API handoff is intentionally not faked. A real Mobile Cash provider secret/account must be configured before production activation.

## Security

- Payment tables use RLS.
- `payment_webhook_events` is not readable by `anon` or `authenticated`.
- Payment RPCs are authenticated-only except the webhook RPC, which is executable only by `service_role` and is additionally protected by the signed Edge Function.
- Payment transactions are immutable.
- Wallet payment is atomic with order creation.


## Verification notes

Live database changes were applied directly through Supabase SQL execution and verified with advisors. The local source archive is the application/source snapshot; it is not a claim that a single migration file reproduces every live hardening statement.

The production Edge Function `mobile-cash-webhook` is deployed and ACTIVE (version 3 after the payment-intent binding hardening). It intentionally remains non-operational until the real `MOBILE_CASH_WEBHOOK_SECRET` and provider account/contract are configured.

## Payment flow

1. Customer submits checkout with COD, Wallet, or Mobile Cash.
2. `checkout_and_initialize_payment` creates the order(s) and initializes payment in one database transaction.
3. Wallet payments atomically debit the customer wallet and mark the session orders paid.
4. COD creates per-order payment intents; the captain records collection after delivery and the payment center reconciles the collection.
5. Mobile Cash creates a `requires_action` payment intent. A signed provider webhook must supply the matching `checkout_session_id`, `payment_intent_id`, exact amount, and provider status before the order becomes paid.

Vendor settlement remains a separate finance-controlled step after the existing delivery/payment prerequisites; payment success is not treated as automatic vendor payout.
