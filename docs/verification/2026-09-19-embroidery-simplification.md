# Automatic embroidery variants

## Behavior

Standard flat embroidery first tries the existing logo and bounded placement search. If that cannot pass, the worker asynchronously submits one simplified adaptation per source hash and policy version (v2). A private Storage reservation prevents duplicate paid submissions across products. Polling, cleanup, and independent identity/geometry inspection run in separate worker steps. Failed or ambiguous requests do not automatically resubmit. Reservations expire after 15 minutes into a review result.

The policy permits omission of secondary descriptors/slogans/decorations while preserving primary brand spelling and recognizable primary symbol. Up to six flat colors, bold text, wide gaps and simple silhouettes are requested. This is not physical stitch certification.

An independently inspected derivative is fitted and evaluated for every product print area. Only passing products proceed. Derived artwork path is persisted and used by previews, render files, mockups, and supplier sync. Original print-product artwork is untouched. Old proof URLs are removed before selecting a new derivative; already-generated supplier batches cannot silently switch artwork.

## Verification

- Full suite: 120 passed. TypeScript and scoped ESLint passed; diff whitespace check passed.
- Tests cover changed spelling, lost primary symbol, unauthorized omissions, invented content, incomplete verdicts, queue URL restriction, result-host restriction, pending yield, cached failure, stale reservation, one submission/inspection shared across subsequent uses, and worker selection of the derivative instead of stale original proof.
- Live Sunday Sauce generation tested two development prompts. First retained excessive detail and failed physical checks. Revised candidate failed independent identity acceptance; no embroidery product auto-approved. Failed artifact remains private.
- New private `embroidery-preparations` bucket accepts only JSON/PNG, maximum 20 MB; no anon/authenticated object policies apply. Migration 20260919224400 applied and registered. Existing bucket policies were checked.
- No physical orders placed. No claim that generation guarantees a stitchable design.

## Review receipt

### Actionable Findings

Fixed: original proof URLs could survive derivative selection. Worker now clears stale artwork/preview cache and rejects swapping artwork after supplier generation starts.
Fixed: existing logo bucket does not permit JSON; introduced a separate server-only bucket instead of relaxing original asset permissions.
No remaining actionable defects identified in the scoped correctness, failure-path, security, and integration review.

### Coverage

Sequential in-context review per AGENTS.md; no independent/delegated review. Scoped to new embroidery provider/state machine, worker integration, state field, storage migration, live test script, and tests. Simplification/reuse scan retained separate provider and persistence responsibilities; no generic job framework introduced. Existing rendering/publication call chain inspected. No authenticated browser or physical embroidery verification.

### Verdict

Ready with explicit limitation: uncertain or unsuitable derivatives remain review. Sunday Sauce is such an exception in this live test; thresholds were not weakened to obtain a pass.

## Deployment validation

New uploads should preserve original store logo, submit at most once per source/policy, yield while queued, and reuse the same derivative across embroidery products. A product must never publish a derivative without passing identity and per-area screening. Existing failed Sunday Sauce embroidery jobs will be retried under the new pipeline after deployment; cached failed candidate will produce the updated review reason without another paid generation. Rollback if original printed product artwork changes, repeated submissions occur, or supplier artwork differs from evaluated artwork.

Production deployment reached READY and aliased www.ezmerch.store. Requeued only the three unpublished, unreviewed Sunday Sauce embroidery holds using updated_at/status guards. All three were processed and returned to review with the cached independent identity-check failure; no new paid generation or supplier sync occurred for those jobs. Original printed products were not modified.
