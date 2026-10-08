# Logo print quality and selective enhancement

## Scope and review
Reviewed only the new logo preparation/enhancement/quality workflow, its migration, worker integration, onboarding and replacement upload UI, and tests. Other working-tree changes belong to earlier tasks. Intent comes from the approved conversation: retain originals, preserve transparency, selectively enlarge once through Fal, require visual approval, check each physical print placement, and separate embroidery review.

Review was performed sequentially in the main thread per repository AGENTS.md, covering correctness, security, persistence, concurrency, failure handling, API compatibility, resource limits, UI state and tests. No independent reviewer or cross-model assessment is claimed. Simplification review retained existing separation of upload, provider and quality logic; no behavior-preserving refactor was warranted. Final review has no unresolved blocking finding. Fixes during review: preserve sRGB ICC on rendered printfiles; remove private orphan files after a duplicate preparation insert loses its race; allow continuing with original while Fal processes; preserve tiny-alpha transparency at image edges.

## Verification
- 87 automated tests passed, including PGlite migration/permissions, daily enhancement reservation cap, duplicate request protection, provider URL validation, alpha restoration and print-size checks.
- TypeScript check and production build passed.
- Scoped lint passed with image-element warnings; raw images are intentional for direct artwork preview. Full-repository lint has 12 pre-existing errors in cart-provider and previous notification/Stripe tests, unrelated to this feature.
- Real authenticated HTTP test against local application with production Supabase and Fal: synthetic logo prepared, repeat upload reused its ID, unsigned enhancement read returned 401, queued enhancement completed in 24 seconds, 240x259 -> 960x1036 PNG with alpha. Test account, preparation row and private test files removed afterward. No customer artwork sent, no customer products regenerated.
- Browser checked initial upload UI, disabled save before review, and blocked print-quality report through temporary real-component fixture; fixture removed. Full authenticated interactive browser flow was not tested.
- New additive migration applied transactionally and registered without replaying older migration history. Enhancement reservation is service-only; originals bucket private; table RLS enabled. No customer data backfill.

## Operational behavior and limits
FAL_KEY is server-only. Small uploads now start enhancement automatically (longest edge below 3000 pixels, within the 4x/6000-edge/25MP limits); manual enhancement remains available. Results are cached per user/upload/background-removal setting, capped at ten submissions per user/day. Provider status polling occurs only during active review and stops after five minutes; queued results can be checked later. Originals and cleaned/enhanced masters remain separate. A failed or uncertain submission is not automatically charged again.

New uploads get placement-aware quality checks before supplier sync or preview publication. Existing artwork/jobs are grandfathered; replacing a logo opts into checks. Quality blocks fail immediately rather than consuming repeated worker retries. Resolution blocks require a better logo or smaller template; reviewable embroidery/transparency concerns require an authenticated owner/admin acknowledgment recorded with user and time.

The 75 source-PPI floor for AI enlargement is an application guardrail, not a Printful guarantee. Output must still meet each printfile DPI (at least 150). Pixel dimensions cannot establish legibility or stitch quality; visual review and physical samples remain necessary. Generic flat-embroidery guidance cannot certify puff embroidery or special techniques. Background removal handles plain backgrounds, not arbitrary photographic scenes.

## Rollback
Revert application changes to prior deployment if necessary. Leave the additive private table and bucket in place to preserve originals. Do not drop stored originals or modify existing generation jobs. Old application ignores the new table and sidecars.

Production deployment completed. Live unauthenticated enhancement endpoint returned 401; Mazellist storefront returned 200. Database verification confirmed RLS enabled, originals bucket private, and zero remaining synthetic preparation rows. Security advisors reported pre-existing unrelated warnings, none naming the new table or reservation function. Temporary pulled production environment file removed after testing.

## Automatic enhancement follow-up
The former UI required an enhancement click; small prepared logos now trigger the same owner-scoped, single-reservation server helper during upload. The client automatically selects cached or completed enhancement, resumes queued/submitting preparations, and replaces the obsolete small-original warning with enhancement status. Product-specific gates remain in force. 88 tests pass, TypeScript passes, scoped lint has only the intentional raw-image warning. Production aliases were verified to point at the preceding release; the reported screenshot shows an older UI, but its browser cache state could not be inspected.
Real follow-up HTTP test passed: preparation itself returned queued without an enhancement click; 240x259 -> 960x1036 with alpha in 53 seconds, cached repeat preparation and unauthorized access rejection verified. Synthetic records/files/account cleaned up.
Automatic enhancement release submitted as https://ezmerch-bp7nwk7jo-9i9e.vercel.app (dpl_45d4FdSzUu48WkUkpU29vP3D9hje); still INITIALIZING at end of turn. Vercel status reports an active Elevated Errors Triggering Deployments incident (2026-09-18 20:32 UTC), likely explaining this external block. Automatic enhancement is NOT yet confirmed live. Local production build passed. Recheck deployment and production alias before claiming shipped.
