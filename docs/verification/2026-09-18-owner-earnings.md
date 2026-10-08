# Owner earnings: 30-day setup policy

## Implemented contract

New payments tagged `owner-margin-70-30-30days-v1` reserve 70% of merchandise margin after quoted Printful production/printing costs. Shipping and sales tax are excluded. Each successful payment gets its own 720-hour deadline based on the signed Stripe success event. Completion of Stripe verification by that deadline qualifies the share; later processing does not revoke timely qualification. Otherwise the share expires to EZMerch. Later setup qualifies subsequent sales and earlier sales still within their own windows. No historical order backfill or forfeiture occurs.

New payments use platform charges and separate transfers. Stripe metadata includes store name, store ID, storefront URL, cost/split values, policy version, and the EZMerch order ID once the success webhook has recorded the order. Legacy destination-charge refunds retain their existing reversal behavior.

## Operations

- `/api/cron/earnings`: every five minutes, at most five entries and a 40-second between-entry budget; 120-second runtime and 180-second DB lease. It is independent of the mockup/catalog pause switch.
- Indexed pending checks: daily without an account, hourly with an account. Refund/dispute webhooks and verification events wake the affected entries. Final entries otherwise sleep.
- Separate Connect webhook records the first fully verified timestamp. Duplicate and out-of-order delivery cannot move that timestamp later.
- Sale/setup emails plus reminders at days 7, 21, and 28 reuse the existing Resend outbox. Completion and expiration notices are deduplicated by recipient/order/event. Unclaimed stores notify admins when no owner email is known.
- Admin and owner earnings pages show original/current share, deadline, status, net transfer and errors. Transfers are not bank payouts.
- Expiration never occurs when Stripe verification fails due to an API error.
- Stripe transfers require sufficient platform funding. Failures remain eligible, retry, and alert admins. This change does not alter EZMerch's bank payout schedule or segregate its Stripe balance.
- Amount-only partial refunds reduce owner share proportionally to the refunded charge amount; full refunds reverse the whole owner share. Disputes stop/reverse transfers. A won dispute requiring a new transfer after reversal is flagged for admin reconciliation, not automatically paid twice.

## Review

Review performed sequentially in the main context under repository AGENTS.md. No external reviewer or independent-agent review was used.

### Actionable Findings

Resolved before deployment: preserve earliest verification despite delayed events; distinguish reserved earnings from immediate transfer eligibility; deduplicate notification/outbox writes; recover transfers after lost responses beyond Stripe's idempotency window; lease work and preserve concurrent webhook wakeups; protect financial timestamps/ledger from browser writes; handle partial/full refunds and full refund dashboard status; keep new expiry rules off historical payments.

### Coverage

Reviewed checkout, signed platform/Connect webhook processing, ledger SQL/RLS, worker transfer/reversal/retry paths, onboarding acceptance, owner/admin views, Resend outbox reuse, migration and cron configuration. Simplification retained existing email delivery and revenue helpers. Scoped lint and TypeScript checks are required; existing catalog `<img>` lint warning is unrelated. Production bank payouts and live paid fulfillment are outside automated verification.

### Verdict

Ready subject to successful final checks and production smoke verification. Funding shortages and post-dispute adjustments remain visible operational actions rather than silent loss of eligibility.

## Verification

- Deadline, exact boundary, day-40 setup, refund arithmetic tests.
- Isolated PostgreSQL tests execute the real migration/RPCs/triggers: idempotency, outbox dedupe, earliest readiness, leases, audit entries, owner isolation, anonymous denial, browser write denial.
- Actual worker with isolated PostgreSQL and simulated Stripe: API outage, expiration, delayed eligibility, lost transfer response recovery, duplicate retry, partial and full refunds.
- Actual Stripe sandbox with isolated PostgreSQL and actual worker: pending sale, ready account, $12.60 transfer for an $18 margin, no duplicate transfer on rerun, full transfer reversal after refund. Payment `pi_3UH6DJFCUSaL3NFu1mc1KaUg`, transfer `tr_3UH6DJFCUSaL3NFu1ZF7qO0v`.
- Actual checkout/signed-webhook sandbox handler tests use database/Printful fixtures. No live card charges, production orders, or paid Printful fulfillment.

## Post-deploy validation

Confirm cron auth denial without token and an authenticated empty worker result; public homepage/storefront HTTP 200; dashboard routes require login; connected webhook signature validation; new table RLS and service-only function privileges; Resend configuration remains enabled. After the first real sale, inspect its earnings row, payment metadata, sale email/outbox, and source-charge-linked transfer. Investigate duplicate transfers, missing earnings rows or persistent worker errors immediately. If needed, pause earnings cron only while preserving ledger rows and webhook capture; do not delete rows or reset eligibility timestamps.

## Final results

- 69 unit/database/worker tests passed; TypeScript and production build passed.
- Two real-Stripe checkout/webhook sandbox tests passed.
- Real Stripe worker test rerun after payment-label updates passed: payment `pi_3UH6G5FCUSaL3NFu0SBEwaDa`, transfer `tr_3UH6G5FCUSaL3NFu0VrDfOAi`, $12.60 transferred and fully reversed.
- Migration `20260918180120` applied and recorded without changing unrelated migration-history drift. Security advisor reported no findings for the new earnings tables/functions (eight pre-existing warnings remain outside this scope).
- Live Connect webhook `we_1UH6EgFac2uxKDhqzAwz9XUv` configured; signing secret stored as a sensitive production environment variable. Signed non-mutating probe returned 200. Platform webhook now includes dispute closure events.
- Existing verified connected store readiness initialized before rollout.
- Production deployment `dpl_AZtK63JTSfBEcx37GpUu6CeybmdZ` ready at www.ezmerch.store.
- Public homepage/storefront returned 200; unauthenticated earnings pages returned login redirects; unauthenticated cron returned 401; authenticated worker returned 200 with zero processed/errors/sent. Email configuration remained enabled and valid.
- Production still had no orders during migration verification. No fabricated production orders or owner earnings were inserted; no real card charges, live transfers, or test messages to owners were sent.
