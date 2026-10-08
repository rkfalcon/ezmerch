# Automatic placement and actionable artwork review

Implemented and deployed September 22, 2026.

- Printed artwork can grow within the same print area in one-percent steps when smaller text needs more space. DTG shrinking searches down to a useful 2.5-inch longest dimension for front/chest alternatives. Resolution, visual changes, transparency, and embroidery checks remain enforced.
- Templates have an explicit `allow_front_fallback` checkbox (default false). When permitted, the planner checks centered-front and left-chest alternatives using the same supplier front print area. Other print locations are not silently substituted.
- Unresolved reviews have a placement simulation, optional actual Printful review mockup, physical dimensions and estimated lettering size, admin placement/scale adjustment, and actual-size PDF download. Supplier review mockups do not approve, sync, or publish products, and wait behind first-color work.
- PDF uses supplier canvas DPI, trims empty space, draws pixels at exact PDF point dimensions, tiles large artwork across Letter pages, and includes a 72-point/one-inch measuring reference. Screen previews explicitly do not claim physical calibration or fabric fidelity.
- Admin adjustments require a held job, validate permitted placement/scale, reject previously submitted/published jobs, invalidate old proofs/approval/preview and rebuild catalog/color batches, and use optimistic concurrency. The generation changes atomically with the new state. Owner routes do not expose review controls.
- Existing EzMerch artwork notification handling remains in place. Owners are told no action is required.

Verification: 144 tests passed, TypeScript passed, ESLint had only img-element warnings. Tests cover the saved Sunday Sauce geometry, enlargement, template alternative permission, damaged-artwork holds, unsafe adjustment rejection, stale-proof invalidation, PDF physical dimensions and tiling. Actual PDF rendered and visually checked. Production authenticated checks verified PDF response, unauthorized denial, unsupported adjustment rejection, and desktop/mobile admin controls. Temporary test accounts were signed out and deleted.

Sunday Sauce Comfort Colors 1717: template alternative enabled and existing held job reassessed through the authenticated API. It automatically passed at centered front 59%, 7.08 x 7.17 inches, original 75 PPI / prepared 301 PPI / required 150 PPI. Regeneration completed. Public product page verified with the larger actual Printful mockup and exactly 25 selectable colors. No manual approval used.

No physical garment sample was printed; software checks and mockups cannot certify fabric output.

Live optional review render on the hidden test store completed through Printful. Assertions confirmed the job remained failed/unpublished until a subsequent explicit admin adjustment was submitted. The valid adjustment API succeeded. A regression test covers completed supplier responses that also contain task_key.
