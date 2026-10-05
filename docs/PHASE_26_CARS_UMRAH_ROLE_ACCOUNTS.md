# SHAKH 2027 — Phase 26

## Cars, Umrah booking-only, role account applications, PWA branding

Phase 26 extends the existing SHAKH platform without removing previous commerce, delivery, finance, notification, support, catalog or RBAC functionality.

### SHAKH Cars

Any authenticated customer can publish a vehicle listing. The `car_dealer` role remains available for professional sellers, but it is **not** a prerequisite for posting a car.

Car posting is server-authoritative:
- A configurable platform listing fee is resolved from `car_listing_fee_rules`.
- The customer wallet is checked and debited atomically.
- The same amount is credited to the platform wallet.
- The listing becomes active only as part of that successful transaction.
- Idempotency protects retries from creating duplicate listings or duplicate wallet ledger movements.
- A listing contains multilingual title fields, vehicle metadata, price, mileage, city/district, description and image-array support.

The exact car listing fee is intentionally not seeded because the requested amount was not specified. Finance administrators configure it from Finance Center.

### Umrah

SHAKH handles **booking only**, not the full package purchase checkout.

- The booking fee is fixed at **2,000 IQD** as requested.
- Package price is informational and is not charged by SHAKH in the booking flow.
- The customer pays only the booking fee from the customer wallet.
- The booking creates an immutable financial ledger movement to the platform wallet.
- Capacity is checked and reserved transactionally.
- Umrah agencies can create package drafts after their `umrah_agency` role is approved.
- Approving `umrah_agency` also ensures a draft Umrah vendor record exists for that user.

No real payment-provider credentials or fake package-payment events are created by this phase.

### Role accounts

Normal sign-up creates a customer account first. Professional/operational roles use a secure role-application workflow:

`requested → approved / rejected / cancelled`

Available self-requestable roles:
- captain
- captain_manager
- restaurant_vendor
- supermarket_vendor
- fashion_vendor
- car_dealer
- umrah_agency
- beauty_vendor
- support

`admin` and `super_admin` are deliberately not self-requestable. They remain protected from self-escalation and can only be assigned through privileged administration.

### PWA / Web App

The platform is installable as a Progressive Web App:
- Web App Manifest
- Service Worker
- Offline fallback page
- `beforeinstallprompt` install flow where supported
- iOS/iPadOS Add to Home Screen guidance
- Responsive mobile/tablet/desktop layout
- SHAKH logo applied to the application header, favicon, Apple touch icon and PWA install surface

The uploaded SHAKH logo is stored at `public/brand/shakh-logo.jpg` and is used without altering the source artwork.

### Security

All privileged writes are implemented as private `SECURITY DEFINER` functions with a pinned `search_path` and authorization checks. Exposed RPCs are `SECURITY INVOKER`, with client access granted only to `authenticated` where required. RLS remains enabled on the new public tables.

### Data source

Supabase remains the source of truth. No marketplace business state is stored in `localStorage` or `sessionStorage`, and no static/mock business records are seeded.
