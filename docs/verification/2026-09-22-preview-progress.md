# Adjustment preview progress

Deployed to www.ezmerch.store on September 22, 2026.

- Job polling is sequential, uncached, cancelled on invalidation, and runs every three seconds.
- Adjustment submission immediately shows saving feedback, then artwork preparation progress.
- Review panels are keyed to the artwork generation rather than the quality JSON.
- Printful waiting/rendering states include a spinner and automatic-update explanation.
- A completed preview appears without a refresh and remains subject to explicit approval.
- New adjustments clear the prior preview and approval selection.

Validation: 145 tests passed, TypeScript passed, scoped ESLint had no errors (four img warnings).
Live browser test adjusted the hidden benchmark store's embroidery tote to 65%, observed preparation, and waited for a real Printful mockup without navigating or refreshing. Result: updatedWithoutReload=true, approvalStillRequired=true. No product was approved. Temporary test admin removed.

Script: scripts/verify-preview-progress-live.ts.
Evidence: /tmp/ez-preview-progress-live.log, /tmp/ez-preview-progress-checking.png, /tmp/ez-preview-progress-ready.png.
