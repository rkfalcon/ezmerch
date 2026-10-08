# Store sharing and website-instruction emails

## Delivered
- Store owner dashboard includes canonical store URL and copy control, using the selected owned store without an additional layout database query.
- `/dashboard/store/share` includes WordPress, Shopify, Wix, Google Business Profile post, and HTML guides with copy controls, official help links, two HTML snippets, and developer-email preview/send/status.
- `/dashboard/admin/emails` contains collapsed invitation and website-instruction editors. Legacy invitations URL redirects there.
- Admin controls subject/body; guide is always included, HTML snippets are escaped literal code in email, replies go to the sending owner's email.
- Immutable Resend outbox, per-owner one-minute/five-per-hour throttles, request deduplication, two-minute leases, five attempts within 23 hours. Existing five-minute email cron advances at most one message per queue per run.

## Validation
- 80 automated tests passed, including email rendering, HTML escaping, queue ownership, verified email, private RPC access, retries and provider idempotency.
- TypeScript, focused ESLint, `git diff --check`, production build passed.
- Local browser fixture: URL copy confirmation, all five collapsed guides, populated HTML code, mobile layout at 390px, admin subject editing updates preview, complete guide present in preview. Fixture removed before deployment; dev server stopped.
- Production migration applied with migration history. A rollback-only live test under service_role validated queue/deduplication/lease and left zero test emails. This caught and corrected an auth.users permission mismatch: the queue function is SECURITY DEFINER with empty search_path and service_role-only execute, with explicit verified-owner checks.
- Supabase security advisors at error level: no issues found.

## Limits
- No real email sent: no recipient was authorized. Provider delivery is tested with mocks; real mailbox receipt remains a user acceptance check.
- Browser session was signed out; UI checked using real components in a temporary local fixture. Auth ownership is covered by action guards and database tests.

## Production
- Deployment `https://ezmerch-l8mh81c9s-9i9e.vercel.app` READY; aliased `https://www.ezmerch.store`.
- Signed-out owner/admin sharing routes redirect to login; temporary fixture returns 404.
- Email worker without credentials returns 401; authorized empty-queue run returns 200 with both queues reporting `sent:false` (no messages sent).
