# Quick previews after logo upload

## Cause
Sunday Sauce had nine pending jobs and zero previews. The fulfillment worker advances one stage per scheduled invocation. Quality checks added an additional stage before the existing instant-preview stage. The existing renderer also excluded embroidery/curved placements. Separately, Sunday Sauce is an admin-created, unclaimed store with selling_enabled=true: the storefront previously hid every pending preview whenever selling was enabled.

## Fix
Logo replacement and onboarding now start a separate bounded preview pass after saving the logo. Two render operations at most run concurrently, with a 120-second scheduling budget. One logo download is shared; existing cached Printful layout data is reused. This creates placement previews only, using Printful's supplied layout coordinates. Approximate embroidery/sublimation previews are allowed without asserting stitch or final wrap fidelity. The original official renderer and fulfillment quality gates are unchanged.

A separate quick_preview_url column avoids overwriting large worker state. Writes compare logo_path and generation_id to reject old generations. A database trigger clears the preview upon logo or generation replacement. Dashboard progress, onboarding and non-purchasable storefront preview cards use this URL as fallback. Preview cards also appear on already-open storefronts; they have no purchase controls.

## Verification
- Sunday Sauce real preview pass: eight available products generated and persisted, including two hats. Printful reports the bottle's sole White variant 20175 in_stock=false, so it was skipped.
- Database regression test verifies unrelated worker writes retain previews and logo replacements clear them; stale generation writes cannot restore old art.
- TypeScript and tests run; scoped lint has only intentional image-element warnings.
- Sequential review checked generation race, supplier rate limit stop, bounded concurrency, image URL allowlist, absence of fulfillment mutations, and old-vs-new-logo separation.

## Limits
These previews appear as the short pass completes, not synchronously before upload returns. Provider latency/cache misses can delay them. Print quality review and official mockups remain separate. No stock or quality gate was bypassed. A timeout/provider failure leaves the existing official generation flow as fallback. Runtime pass reads provider catalog once per product; it does not scan orders or full job JSON, submit provider mockup jobs, or enable sales.

Final verification: all 89 tests passed; local production build passed. Browser verified eight rendered Sunday Sauce logo previews on the actual store data via localhost, including the left-chest shirt and beanie. Final intended deployment is ezmerch-qhneadlzu-9i9e.vercel.app / dpl_3AC3fwmgqL7DQpUEeNEtSoe9Voos; still INITIALIZING at end of turn, so live display fix is not confirmed. Earlier superseded build ezmerch-pyc84szis-9i9e.vercel.app omits the open-store preview fix; do NOT promote that build. When Vercel recovers, verify/promote qhneadlzu and inspect www.ezmerch.store alias plus /sundaysauce preview images.
