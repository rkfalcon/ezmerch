# Product price and owner earnings

Added authenticated product earnings endpoint scoped to the store owner or admin. Uses cached USD catalog variant prices for the product's actual decoration technique; no order is created. Missing prices remain unavailable. Shares calculateRevenueSplit with checkout, using 70% of merchandise margin and the existing reserved-owner-share policy.

Shared LineupProductPrice now displays saved retail price and estimated owner earnings on owner and admin product lists. Editing a size or all sizes recalculates earnings against the proposed price, with ranges across variant costs, production-cost context, and a below-cost warning. Existing saving, minimum-price enforcement, owner authorization, and route revalidation remain in place. Cancelled edits reset when reopened.

Estimates use catalog production costs rather than final checkout quotes. Discounts, extra production charges, order-level rounding and payout eligibility can change final earnings; the editor explains this. Shipping and tax are excluded. No new database schema or customer price mutation was required.

181 tests passed, including saved variant prices, all-size price changes, missing costs and below-cost handling. TypeScript and scoped ESLint passed. Production deployment logs: /tmp/product-earnings-deploy.log and /tmp/product-earnings-final-deploy.log.

Authenticated production browser verification passed: unrelated user denied (403), admin cost map valid, saved-price summary visible, proposed price updated earnings, cancel used without saving. Shared UI inspected at desktop and mobile widths. Temporary account removed. Screenshots: /tmp/verymerch-earnings-1280.png and /tmp/verymerch-earnings-390.png.

Follow-up verification caught paginated catalog prices (default 20 variants); added explicit 100-variant pages until complete and a technique-specific pagination test (passed). Live staple-shirt lookup now covers 668 catalog variants. Added normal text wrapping in table cells for the editor. Latest deployment: /tmp/product-earnings-complete-deploy.log (production alias confirmed).
