# Product Template Lineup Implementation Plan

**Goal:** Upload one store logo to generate its branded lineup, automatically roll new templates out as drafts to established stores, and notify owners/admins in-app and by email.

**Architecture:** Extend the existing Supabase database with templates, durable per-store generation jobs, and a notification outbox. Database triggers enqueue work atomically; a bounded worker advances persisted Printful mockup/sync-product stages, using stable external IDs and a lease. Use existing product rows, storefronts, auth, and UI components.

**Tech Stack:** Next.js 16, Supabase Postgres/Auth/Storage, Printful legacy catalog/mockup/sync APIs, Sharp, Resend HTTP API. Node tests with tsx and PGlite for real SQL behavior.

**Spec:** docs/plans/2026-09-14-product-lineup-requirements.md

## Global constraints and resolved defaults

- Existing database and stores remain intact; additive migration only.
- Initial generation publication eligibility is captured before a batch begins. Any preexisting product, including hidden/draft, makes a store established.
- All available colors and apparel sizes; sticker prices are size-specific. No automatic price increases beyond the user-supplied prices.
- Templates own default prices/placement; admins can override existing generated product prices without rewriting template defaults. Template edits do not overwrite existing products.
- Uploading a replacement logo affects future generation only; existing products remain unchanged.
- Both owner and all admin accounts receive dashboard/email notifications for completed draft additions. No owner means admin notifications only.
- Failed items are never published. Retry preserves saved stage and external identity. Hidden products are never restored by rollout.
- Existing stores need a normalized uploaded logo to generate safely. Surface missing-logo status.
- Delivery configuration and live verification require existing service credentials; never invent credentials or claim live verification without them.

## Task 1: Durable database lifecycle and policy tests

Files: Supabase migration, tests/lineup-database.test.ts, tests/database.ts.
Interface: service-only RPCs to claim jobs and complete products atomically; authenticated users can read only permitted jobs/notifications.

- [ ] Write SQL integration tests for initial live batch, established-store drafts, activation fanout, deduplication, atomic completion notifications, and recipient isolation.
- [ ] Run against the empty migration and observe missing-schema failure.
- [ ] Implement tables, RLS/grants, private trigger functions, leases, completion, and seed nine inactive configurable template presets.
- [ ] Run SQL tests, including rollback on failure and disabled-template behavior.

## Task 2: Printful generation and email delivery

Files: lib/lineup/{types,pricing,artwork,printful,worker,notifications}.ts, lib/supabase/admin.ts, tests/lineup.test.ts, tests/printful.test.ts.
Interface: runLineupWorker() advances bounded durable jobs; catalog resolver uses actual API IDs; artwork fit calculates exact canvas placement.

- [ ] Add failing tests for price rounding, artwork proportions, printfile-to-variant matching, sync variant mapping, and HTTP error propagation.
- [ ] Implement image normalization and per-print-area artwork, legacy option groups, mockup polling and durable storage, idempotent sync creation, and completion RPC.
- [ ] Implement per-recipient email outbox delivery with bounded timeouts, idempotency keys, retry/backoff, and explicit missing-config state.
- [ ] Verify mocked external HTTP contracts plus real artwork and SQL integration tests; no test orders or actual emails.

## Task 3: Admin and store UI

Files: app/actions/lineup.ts, app/api/lineup/*, components/dashboard/lineup-*.tsx, admin templates and notifications pages, store product/admin detail pages, existing publish action.

- [ ] Add template preset activation, catalog search for future templates, pricing/placement controls, and enable/disable behavior.
- [ ] Add normalized logo upload and generation progress/retry controls to store admin; automatic trigger on successful upload.
- [ ] Show real branded thumbnails in admin listings and per-variant images on the public product detail page.
- [ ] Add editable product prices and tenant-scoped hide/publish actions with error reporting.
- [ ] Add dashboard notifications for both roles and mark-read handling.

## Task 4: Worker scheduling and verification

Files: app/api/cron/lineup/route.ts, vercel.json, .env.example, docs/setup-product-lineup.md.

- [ ] Schedule bounded worker ticks with authenticated cron and start a tick after mutations. Jobs survive page closure and process restarts.
- [ ] Document migration, storage, Printful credential scope, email sender verification, cron setup, rollout, and retry workflow.
- [ ] Run tests, TypeScript, lint, production build, migration security checks, and browser checks where configuration allows.
- [ ] Review full diff for tenant isolation, duplicate products, stale leases, shipping identifiers, pricing, and secret exposure before committing/pushing.

## Verification examples

```ts
assert.equal(retailPrice(2263, false), 3100);
assert.equal(retailPrice(234, true), 600);
assert.equal(retailPrice(254, true), 700);
assert.equal(retailPrice(547, true), 900);
assert.deepEqual(fitArtwork(2000, 1000, 1800, 2400, 0.8),
  { width: 1440, height: 720, left: 180, top: 840 });
```

SQL tests assert every job of an empty store has publish_on_complete=true; adding a template after products exist creates only new draft jobs; repeating enqueue never duplicates a store/template pair; completion creates exactly one product and one notification per recipient; another store owner cannot read these rows.
