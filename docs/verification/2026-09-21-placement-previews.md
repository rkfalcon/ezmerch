# Placement previews and larger print sizing

## Scope
Changes in this turn only: artwork-plan, job-preview helper, lineup jobs API, onboarding image selection, LineupLogo captions, instant-preview asset keys, worker preview plan marker, GenerationState, and related tests. Existing unrelated working tree changes were retained.

## Actionable Findings
No remaining findings in the scoped implementation after corrections. The first test run caught an embroidery regression: larger embroidery placements must remain candidates for stitchability. That behavior was restored without expanding DTG beyond the configured maximum.

## Coverage
Sequential source review under repository AGENTS.md (no independent reviewer): checked unchanged quality gates, image precedence, stale fallback suppression, generation isolation, preview asset overwrite races, query response projection, and existing progressive-generation tests. Preview asset keys now include artwork and placement. Preview plan markers prevent unverified legacy preview reuse. No schema, payment or order changes. Existing published print files have not been modified. No physical sample or authenticated production UI test performed.

## Verdict
Locally verified implementation. 123 tests pass, TypeScript passes, scoped ESLint has zero errors (two existing img warnings).

## Sunday Sauce read-only assessment
Verified enhanced artwork SHA-256 matches the saved visual comparison. Reused that evidence rather than rerunning an AI check until it passes. Existing original-detail, prepared resolution, transparency and lettering gates remain unchanged.

Bella 3001, long sleeve and tank: 59%, 7.08 x 7.17 inches, original 75 PPI, prepared 301 PPI, required 150. Hoodie: 51%, 7.05 x 7.14 inches, original 75 PPI, prepared 303 PPI, required 150.
These are automated screening results, not a physical print guarantee. Existing listings remain at their current approved placement until regenerated through a new generation; no existing fulfillment URLs were overwritten.
