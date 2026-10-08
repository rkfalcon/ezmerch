# Previous artwork purchase holds

New generation IDs or logo paths now mark existing product variants artwork_pending, retaining records for price preservation. The shared enabledVariants helper excludes held artwork in storefront grids, product pages and server checkout. Checkout returns a specific 409 for stale carts before creating a payment. Progressive publication replaces freshly synchronized variants without the flag; unfinished variants retain the hold. Completed generation replaces the full array normally. Existing order fulfillment identifiers are not changed.

Backfill compares existing variant image URLs with current-generation published mockup URLs and holds only previous artwork on in-progress jobs. Current-generation mockups remain available.

Verification: 127 full tests pass; TypeScript/scoped ESLint pass. Additional targeted PGlite test verifies current-generation variants survive backfill while previous variants remain held. Existing regeneration integration tests retain product identity, prices, owner visibility/color choices and stale-lease rejection. Source review confirms checkout and public product selectors use the shared filter, and worker variant payloads do not copy the hold from old records. No payment or physical order was created for verification.
