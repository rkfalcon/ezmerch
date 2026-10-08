# Printed logo edge transparency

New uploads analyze cleaned source RGBA pixels before enhancement. The existing >2% partial-alpha flag is retained. A print-only exception requires every flagged pixel (alpha 21–234) to be within two source pixels of near-opaque artwork and four of near-transparent background. This is a conservative screening heuristic, not physical print certification. Broad translucent interiors, detached translucent artwork and broad feathering do not qualify. Embroidery and all resolution, visual comparison and lettering gates remain unchanged.

The preparation cache key is now quality-v2 so identical reuploads cannot reuse the old assessment. Enhanced metadata inherits the source assessment; enhancement already restores source alpha. Existing live jobs were not mutated.

Read-only replay using current Mazellist clean artwork, saved visual comparison and product template snapshots: all five printed products returned ready (tank, Comfort Colors tee, hoodie, staple tee, long sleeve). Three embroidery products remained review. Water bottle without prepared batches was not assessed.

Validation: 155 tests passed; TypeScript and scoped ESLint passed. Added fixtures for edge smoothing, translucent interiors, isolated translucent artwork, broad feathering and opaque artwork, plus approval-gate regression coverage. Real upload and asynchronous generation remain to be exercised by the user's reupload.
