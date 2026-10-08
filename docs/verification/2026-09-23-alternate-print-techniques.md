# Alternate catalog printing techniques

Catalog filtering now checks every advertised technique. Non-embroidery selects an available printing technique, preferring a matching default. DTFILM is displayed as DTFlex / DTF printing. Clicking a product passes the selected technique to the template form, including when selecting the same product again under a different filter.

Explicit alternate techniques flow into printfile and mockup requests. Stock refresh and checkout availability resolve the selected technique rather than the catalog default. Legacy dtg/sublimation template semantics remain unchanged. Fulfillment sync files retain the selected printfile placement through the existing syncPayload path; orders and fulfillment cost estimates use those sync variants. The DTF hats use front_dtf_hat, not an embroidery placement.

Alternate catalog prices come from the v2 technique-specific variant prices, without falling back to default prices. Browser and server quote caches include the selected technique. Template saving validates supported techniques and valid placement mappings.

Read-only live checks: Classic Dad Hat 6245CM, Distressed Dad Hat 104-1018, and Classic Rope Cap 258 all match the filter, select dtfilm, return front_dtf_hat, and have available US stock (11, 3, 4 variants respectively). No products, mockup tasks, orders or payments were created during these checks. Existing embroidery templates were not converted.

160 tests passed, TypeScript passed, scoped lint has only the pre-existing catalog img warning. Tests cover mixed technique matching, selected technique, DTF mockup request and placement, technique stock resolution and alternate price isolation. Full paid fulfillment was not exercised.
