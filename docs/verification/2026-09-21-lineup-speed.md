# Lineup throughput improvements — 2026-09-21

## Changes

- Cache quick-preview catalog and printfile metadata for 24 hours in the existing service-only preview cache. Manufacturing and stock checks remain live and authoritative.
- Cache supplier blank preview assets as bounded 900px PNGs in Storage. They contain no uploaded customer artwork; final composites still use each generation's approved placement and logo.
- Add Vercel Queue wakeups around the existing DB state machine. A private consumer runs at most four sequential job steps/20-second soft claim budget, then schedules the next due work. Deduplicated three-second minimum wakeups, global DB lease, existing supplier pacing and retry handling remain. Cron remains a recovery mechanism. Work more than 60 seconds away is left to cron rather than maintaining idle queue chains.
- Copy up to three generated images concurrently per step. Wait for all copies to settle before releasing the lease, including on error. Stable paths and checkpoint cursor preserve safe retries and color-to-size mappings.
- New work uses one initial color, followed by up to ten colors per mockup task. Existing progressive jobs retain saved batches, IDs, image paths and tasks.
- Structured logs record preview timing, worker steps, publication/completion, queue delivery, and actual Printful rate-limit headers. Disable queue scheduling/processing with LINEUP_QUEUE_DISABLED=true; the cron path continues.

## Evidence

- 133 automated tests pass; TypeScript passes; scoped ESLint passes.
- Database wakeup RPC is service-role-only, excludes inactive/discontinued/failed jobs, respects the global active lease, and returns no work when empty. Migration 20260921175458 applied and recorded.
- Real Printful five-color task: all five images completed by first poll at 20 seconds.
- Real ten-color task: all ten images completed by first poll at 13 seconds. Poll timing differs, so this does **not** establish that ten colors renders faster. It establishes successful ten-color processing without a long delay in this sample. No fulfillment orders or product publication occurred in this benchmark.
- Actual create-task response headers: x-ratelimit-limit=2. Keep 32-second submission spacing; do not assume established-store 10/min eligibility.
- One real staple-shirt quick preview: first run 4,425ms, cached run 1,805ms. These measurements exclude logo upload, enhancement and quality assessment and are not a full-lineup completion SLA.
- Production authenticated cron wake probe returned queued=true. Private queue callback logged processed=0 in 236ms, about 5.4s after scheduling with delaySeconds=3. No pending ready jobs at the time; delayed stock checks and quality holds were not bypassed.

## Optional 25-color cap (not applied)

Read-only dry-run against Sunday Sauce's current variants and printfile groups:

| Product | Colors | Old five-color tasks | New ten-color tasks | New tasks with 25-color cap |
|---|---:|---:|---:|---:|
| Hoodie | 26 | 6 | 4 | 4 |
| Tank | 13 | 4 | 3 | 3 |
| Comfort Colors shirt | 49 | 11 | 6 | 4 |
| Staple shirt | 83 | 18 | 10 | 4 |
| Tote | 12 | 4 | 3 | 3 |
| Beanie | 12 | 4 | 3 | 3 |
| Dad hat | 11 | 3 | 2 | 2 |
| Long sleeve | 16 | 4 | 3 | 3 |
| Total | 222 | 54 | 34 | 26 |

Unavailable bottle excluded. Quality-held products are included as potential workload, not promised publishable products. Selecting a different set of 25 colors can change availability/print-area grouping; this dry-run uses the first 25 catalog colors.

- Batching alone saves 20 submissions (~37%), or 10m40s of theoretical serial submission spacing at 32s each.
- Cap after batching saves eight additional submissions (~24%), or 4m16s of spacing, and 83 color mockups (~37%).
- Cap under old five-color batching: 54 -> 37 tasks (~31%), nine minutes of spacing.
- Actual end-to-end savings depend on quality processing, supplier rendering, sync, and queue waits. First preview remains one color regardless of cap.

## Verification scope

No full new-store upload was initiated, and no existing generation was reset. New batch planning is covered by tests and real supplier image-generation tests; whole-lineup elapsed time under the new queue remains to be measured on a subsequent upload. Four approved Sunday Sauce apparel jobs had already completed before this deployment. Artwork holds remain intact.
