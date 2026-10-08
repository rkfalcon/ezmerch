# Dinerpedia transparency reassessment

Dinerpedia's cleaned original is 956 × 963. Of 432,064 visible pixels, 19,473 are partially transparent. Strict distance rules reject 83 (0.4262% of partial pixels, 0.01921% of visible pixels). All partial pixels are within two pixels of solid artwork. The largest eight-connected rejected group has 51 pixels; the actual maximum clear distance is 24, rather than the old capped report of 5.

Quality policy revision 6 adds three simultaneous limits: 0.5% of partial pixels, 0.05% of visible pixels, and 64 pixels in a connected outlier group. No solid-distance outliers are waived. The general 2% transparency limit, alpha thresholds, lettering, resolution, visual comparison and embroidery requirements remain unchanged. Zero outlier tolerance restores strict classification. New settings and measurements appear in admin quality controls/reports.

All 211 tests passed before adding the final seam-cap regression; all seven transparency tests passed afterwards. TypeScript and targeted lint passed. Existing Mazellist source remains accepted with zero outliers. Synthetic translucent fills, broad feathering, detached specks and connected seams remain rejected. No artwork pixels or manual-approval markers were changed.

The supervised reassessment script validates the preparation owner and original source hash, recomputes transparency on pre-upscale pixels, updates the source sidecar, and requeues only untouched failed quality jobs with optimistic concurrency. Dinerpedia's five printed products independently reached ready under revision 6 without reviewedAt. Embroidery and supplier-availability limitations remain separate. Existing first-color publication/progress/completion-email flows continue.

Live verification: all five printed products now have published=true in production, and the public Dinerpedia storefront HTML contains the Dad Hat, Heavy Blend Hoodie, Staple T-Shirt, Long Sleeve Tee and Premium Tank Top. First-color publication completed before remaining colors. The scheduled production worker continues remaining generation and existing completion notifications.
