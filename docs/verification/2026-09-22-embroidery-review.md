# Embroidery review defaults

Embroidery admin reviews now display the actual Printful embroidery mockup automatically. PDF links, paper-inspection instructions, the expandable placement-review button, and the manual Generate button are omitted. The PDF endpoint rejects embroidery requests as well. Flat approximate thumbnails are suppressed in held admin embroidery rows.

The component submits/polls automatically, respects first-color priority and rate-limit delays, and enables the approval checkbox only after the supplier image loads. Approval wording explicitly refers to embroidery appearance and placement. Existing resolution blocks remain enforced; this change applies to designs awaiting review rather than bypassing blocked artwork.

A separate review_mockup job column caches task and result by a hash of generation, logo, template/placement, proof and variant. Compare-and-swap updates prevent duplicate concurrent submissions and stale generation writes. Task leases expire; completed supplier URLs are reused for 24 hours. Generation state/publication are not changed by preview rendering. The approval API requires a matching current cached mockup for embroidery. Adjustments invalidate the fingerprint.

Verification: 145 tests passed, TypeScript passed, lint has only img-element warnings. Production browser test on Sunday Sauce's tote confirmed automatic supplier-image appearance, no PDF/manual Generate controls, approval enabled only after checking the review checkbox, and reuse after refresh. Direct API tests confirmed PDF rejection and missing-preview approval rejection. Hat and beanie previews also populated automatically. No product was approved by the test. Temporary admin account was signed out and removed.

The supplier image is labeled as a digital preview of stitched appearance; no claim of physical sample verification is made.
