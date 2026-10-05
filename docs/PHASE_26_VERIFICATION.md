# SHAKH 2027 — Phase 26 Verification

## Database

Live Supabase project: `gnfzqctnqplovfzbfsxp`

Applied migrations include:
- `phase26_cars_umrah_role_accounts_v3`
- `phase26_role_application_list_realtime`
- `phase26_finance_pwa_hardening`

Verified live objects:
- `car_listing_fee_rules`
- `car_listings`
- `umrah_booking_fee_rules`
- `umrah_packages`
- `umrah_bookings`
- `role_applications`

Realtime includes:
- `car_listings`
- `umrah_packages`
- `umrah_bookings`
- `role_applications`
- existing finance/delivery realtime tables

## Authorization

Verified design:
- public RPC wrappers are `SECURITY INVOKER`;
- privileged implementations are private `SECURITY DEFINER` functions;
- private implementations are not executable by anonymous/authenticated clients;
- new public tables have RLS enabled;
- car listing fee and Umrah booking fee rows expose only the current effective configuration to public reads;
- role elevation requires privileged review.

## Static/source checks

- TypeScript compiler check: `tsc --noEmit --project tsconfig.json` — passed.
- TS/TSX source count: 94 files.
- `localStorage` occurrences: 0.
- `sessionStorage` occurrences: 0.

## Local package install

`npm install --no-audit --no-fund` timed out in the isolated local environment before creating `node_modules`. Therefore a complete local Vite production build could not be executed in this environment.

The project uses pinned package versions in `package.json`, and Vercel is configured to build from the repository using the standard Vite build command.

## Release blockers / external dependencies

- The exact SHAKH Cars listing fee was not specified, so no arbitrary fee was seeded. Finance Center now provides the configuration control.
- Umrah booking fee is exactly 2,000 IQD.
- No mobile-payment provider credentials/API contract were invented.
- GitHub/Vercel release status must be checked after repository push because external integration permissions are outside the local source tree.
