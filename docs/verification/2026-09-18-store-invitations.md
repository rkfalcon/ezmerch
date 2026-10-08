# Store invitations — 2026-09-18

Implemented admin invitations on unclaimed store dashboards, editable global email defaults and per-invitation subject/body, escaped HTML storefront previews containing all loaded products, and Resend delivery with persisted immutable messages and stable idempotency keys. Invitation links expire in seven days, require the recipient's verified email, and can be replaced or revoked. Acceptance assigns ownership and preserves store configuration. Owners can switch between their stores.

Security: invitation records and email snapshots are server-only with RLS and revoked browser grants. Public stores no longer contain bearer claim tokens. The legacy claim RPC is unavailable to browser roles. New acceptance checks auth.uid(), verified email, expiry, revocation, prior acceptance and unclaimed ownership under row locks. Administrator-only server actions issue invitations and modify defaults. Auth redirects reject external URLs. No existing production unclaimed stores or legacy links were affected.

Verification:
- 75 tests passed; six invitation tests cover recipient mismatch, unverified accounts, expiry, replacement, repeat acceptance, privileges, email leasing/retry, HTML escaping, all-product rendering and redirects.
- TypeScript and focused ESLint passed; production build succeeded.
- Browser checked the actual editor with public Mazellist product data at desktop and 390px width; editing subject updated the preview. Fixed mobile email clipping. Temporary local preview route removed before deployment.
- Production rollback-only transaction issued and accepted an invitation, confirmed ownership and acceptance, then rolled back all fixture data and generated notifications.
- Live privilege checks: anonymous users cannot accept or read invitations; authenticated owners cannot issue invitations directly.
- Supabase error-level security advisor reported no issues (not a claim of zero warnings).
- Production smoke: homepage 200, admin invitation page redirects unauthenticated visitors to login, invalid claim link renders invalid/expired state, unauthorized cron 401, authorized empty invitation worker 200.
- No actual invitation email sent and no full browser signup/mailbox roundtrip performed: the available Chrome session was signed out. Resend delivery was tested with a simulated provider; the live worker confirmed configuration and an empty queue.

Deployment: dpl_BuuS44gVYAHrrVJCBnghaCx5RYPq, https://www.ezmerch.store.
Migration: 20260918185859_store_claim_invitations.sql applied transactionally and recorded in migration history.
Retries: one pending email per five-minute run, max five attempts, two-minute lease, no automatic retries beyond 23 hours (inside Resend's idempotency window). Admin can send a fresh invitation after failure. Sending a replacement invalidates the old link.
