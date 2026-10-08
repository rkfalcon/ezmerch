# Automatic sizing and embroidery screening

## Intent and implementation

Find a suitable scale within each template's print area, preserving proportions and identity. Check preferred size, smaller alternatives, and bounded larger alternatives up to the full area; only front DTG may use the existing left-chest fallback. Passing candidates take priority over review candidates. Every variant print area must pass.

Remove unconditional embroidery review. Standard flat embroidery can pass automatically when fidelity screening, resolution, transparency, solid colors (at most six), simple geometry, estimated minimum text height (0.25 inches), stroke (0.05 inches), and negative space (0.25 inches) checks pass. Other embroidery techniques and missing or uncertain evidence remain review. PPI alone is not stitchability.

Original uploads now receive screening too. Cache by version and source/output hashes. New immutable sidecar path version prevents changing earlier jobs. Existing jobs are not bulk-approved or mutated by deployment.

## Verification

- Full suite: 113 passed before the additional original-cache test; that additional test passed separately.
- Typecheck and scoped lint passed.
- Live fal model accepted matching artwork and rejected an intentionally changed letter.
- Live original solid triangle passed embroidery automatically at 3.2 inches, 281 PPI. First trial exposed a prompt ambiguity about a filled shape's tip; clarified stroke vs corner and retested successfully.
- Sunday Sauce read-only re-evaluation: four DTG jobs find a passing 40% placement; three embroidery jobs still fail minimum lettering size. No database updates, supplier orders, or emails were triggered by this dry run.

## Code review

### Actionable Findings

Addressed: a model could mistake opaque gray for transparency. Actual alpha coverage now independently gates the embroidery background flag.
Addressed: original uploads previously skipped screening. They now use the same cached analysis with identical source/output bytes; regression covered.
Addressed: resizing can improve resolution while making letters less readable. Search accepts only candidates passing all areas and text/stroke/gap requirements.
No remaining actionable code defects identified in the scoped review.

### Coverage

Sequential in-context correctness, failure-path, test, efficiency, and standards review per repository AGENTS.md (no delegated or independent review). Scope: artwork-plan, print-quality, visual-comparison, prepared-logo, operational checker, associated tests. No Next.js API changes. Existing worker was traced: persisted plan is consumed by rendering, mockups and fulfillment; quality gate precedes supplier calls/publication. Simplification review found no worthwhile abstraction to add.

### Verdict

Ready for deployment with limits below. This is automated screening, not physical print certification. Geometry measurements are model estimates and can produce false positives/negatives. Existing held jobs are not silently reapproved. No physical sample or authenticated upload-browser test performed.

## Operational validation

On next upload confirm sidecar quality-v4, comparison version 2, an artworkPlan per job, and ready only when every area passes. Check that original logos use cached screening and no per-product model calls occur. Failed/malformed model response must leave review and existing EzMerch notification flow intact. Roll back if products publish without a passing quality report or render a different plan than assessed.

Source: https://help.printful.com/hc/en-us/articles/28727397325340-How-should-I-prepare-my-design-for-embroidery
