# SHAKH 2027 — UI/UX Phase 05: Shopping Flow

## Scope
The end-to-end shopping and checkout interaction model.

## Added
- Cart model and empty/success states.
- Five-step checkout state machine: Cart → Address → Delivery → Payment → Review.
- Responsive checkout stepper.
- Address form designed for later GPS/map confirmation.
- Delivery option selection contract.
- Payment method selection for Cash on Delivery, SHAKH Wallet and Mobile Cash.
- Order review summary with subtotal, delivery fee and total in IQD.
- UI-only order confirmation boundary ready for backend order creation.

## Data policy
No cart products, delivery options or payment transactions are mocked or persisted. The production implementation expects these records to come from Supabase and payment integrations. React state is used only for temporary UI interaction inside the flow.

## UX direction
Fast, low-friction checkout inspired by high-conversion marketplace patterns while keeping SHAKH's own visual language, Kurdish-first copy, RTL hierarchy and mobile-first composition.

## Integration boundary
The final confirmation action is intentionally an integration boundary. Production code should call the authenticated order-creation RPC/API, persist the order, and only show confirmation after the server-side transaction succeeds.
