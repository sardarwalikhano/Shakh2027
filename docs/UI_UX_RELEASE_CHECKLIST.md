# SHAKH 2027 — UI/UX Release Checklist

## Accessibility
- [x] Keyboard focus remains visible.
- [x] Skip link is available before the primary shell.
- [x] Runtime error has a recovery path.
- [x] Status/error primitives expose appropriate live semantics.
- [x] Reduced-motion behavior is defined globally.

## Responsive UX
- [x] Mobile-first shell.
- [x] Tablet and desktop layout boundaries.
- [x] Mobile bottom navigation.
- [x] Horizontal discovery rails where appropriate.

## Visual system
- [x] Shared tokens for brand, surfaces, borders, shadows and radii.
- [x] Consistent action hierarchy.
- [x] Light/dark theme foundation.
- [x] RTL-first document and layout direction.

## Data integrity
- [x] No marketplace persistence through localStorage.
- [x] No seeded fake orders, products, balances or financial records.
- [x] UI role preview does not replace backend authorization.
- [x] Supabase remains the source of truth.

## Release gate
- [ ] Install dependencies in CI.
- [ ] Run `npm run build` in CI/Vercel.
- [ ] Run browser-based visual QA on preview deployment.
- [ ] Run E2E critical paths.
- [ ] Connect real Supabase catalog/order/financial queries.
