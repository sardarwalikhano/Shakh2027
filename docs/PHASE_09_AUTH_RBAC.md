# SHAKH 2027 — Phase 9: Real Auth + RBAC

## Implemented
- Supabase email/password sign-up and sign-in.
- Password reset request and recovery update flow.
- Persistent Auth session handling and auth state listener.
- Profile + roles loaded from Postgres.
- New auth users receive a `customer` role server-side.
- Account and checkout routes require authentication.
- Dashboard requires one of the configured staff/vendor roles.
- Global header switches between signed-out and signed-in states.
- Browser uses only the Supabase publishable key.
- Current `@supabase/supabase-js` is pinned to 2.117.2.

## Authorization model
The UI role is never the security boundary. PostgreSQL `user_roles`, `permissions`, helper functions and RLS remain authoritative.

New users receive `customer` through the server-side `auth.users` trigger. Privileged roles are not accepted from user-editable metadata.

## Verification
- `on_auth_user_created` trigger exists on `auth.users` INSERT.
- Signup metadata is normalized server-side for language values and phone mapping.
- Security Advisor returned zero findings after the Phase 9 migration.
- Performance Advisor reports informational unused-index findings because the new database has not accumulated production query patterns yet.

## Pending external configuration
- Production email delivery requires SMTP/provider and email-template configuration in Supabase.
- Google/OAuth can be enabled after provider credentials and redirect origins are configured.
