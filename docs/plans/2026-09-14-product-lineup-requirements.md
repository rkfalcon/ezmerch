# Reusable store product lineup

Status: Requirements in discussion; not implemented.

## Confirmed behavior

- Admins maintain a shared, expandable lineup of Printful product templates.
- Apply a store's saved logo to generate the lineup for that store.
- For a new store, uploading its logo triggers generation across all active product templates; no separate per-product setup is required.
- Generated products must appear in that store's admin product listing and public storefront with mockup images showing that store's logo on the actual products, not merely the standalone logo image.
- For a brand-new store with no products, successfully generated products in its initial lineup publish automatically.
- When a new template is added to a store that already has products, generate the new product as a draft and notify the store owner so they can review and publish it. Existing products and visibility choices remain unchanged.
- When new draft products are ready, notify both the store owner and admin through both in-app/dashboard notifications and email.
- Store owners can hide and restore individual products.
- Admins can add more product templates in the future.
- Adding a new active product template automatically generates its product and branded mockups for existing stores with a saved logo. For stores that already have products, successful additions remain drafts and trigger an owner notification. No separate per-store generation action is required. Stores without a logo receive the active lineup when their logo is uploaded; brand-new stores with no products receive that initial lineup live after successful generation.
- Admins can manually set product retail prices. The default is Printful cost plus $8, rounded up to the nearest whole dollar; the formula is not a restriction on manual pricing.
- Sticker costs and sizes have been supplied; use the size-specific prices below.
- Stickers are an exception to the default markup: add $4 to each supplied cost and round to the nearest whole dollar (not always up).
- Initial logo placement: centered front on clothing, front on hats and beanies, centered artwork on totes and bottles.
- Support different placements per product template in the future. Store placement per template rather than hardcoding one global position. The user approved starting with the defaults above.

## Initial lineup selected by the user

Prices below are user-supplied Printful costs. They are not verified current prices or guaranteed prices for every variant. The confirmed retail rule for non-sticker products is: add $8 to each supplied cost, then round up to the nearest whole dollar. For stickers, add $4 and round to the nearest whole dollar.

| Product | Supplied cost | Retail price |
|---|---:|---:|
| Gildan 18500 hoodie | $22.63 | $31 |
| Bella + Canvas 3001 T-shirt | $11.92 | $20 |
| Water bottle with straw lid | $21.80 | $30 |
| Yupoong 6245CM dad hat | $14.02 | $23 |
| Yupoong 1501KC beanie | $13.05 | $22 |
| Westford Mill W101 tote | $10.18 | $19 |
| Bella + Canvas 3501 long sleeve | $18.66 | $27 |
| Cotton Heritage MC1790 tank | $16.62 | $25 |
| Kiss-Cut Stickers — 3 × 3 | $2.34 | $6 |
| Kiss-Cut Stickers — 4 × 4 | $2.54 | $7 |
| Kiss-Cut Stickers — 5.5 × 5.5 | $2.74 | $7 |
| Kiss-Cut Stickers — 15 × 3.75 | $5.47 | $9 |

| Store category | Product | Requested variants | Reference price | Printful page |
|---|---|---|---|---|
| Hoodie | Unisex Heavy Blend Hoodie — Gildan 18500 | All colors; sizes to confirm | $22.63 | https://www.printful.com/dashboard/custom/mens/hoodies/unisex-heavy-blend-hoodie-gildan-18500 |
| T-Shirts | Unisex Staple T-Shirt — Bella + Canvas 3001 | All colors; sizes to confirm | $11.92 | https://www.printful.com/dashboard/custom/mens/t-shirts/unisex-staple-t-shirt-bella-canvas-3001 |
| Home & Living | Stainless Steel Water Bottle with a Straw Lid | Variants to confirm | $21.80 | https://www.printful.com/dashboard/custom/drinkware/water-bottles/stainless-steel-water-bottle-with-a-straw-lid |
| Hats & Beanies | Classic Dad Hat — Yupoong 6245CM | All colors | $14.02 | https://www.printful.com/dashboard/custom/embroidered/dad-hats/classic-dad-cap-yupoong-6245cm |
| Hats & Beanies | Cuffed Beanie — Yupoong 1501KC | All colors | $13.05 | https://www.printful.com/dashboard/custom/embroidered/beanies/cuffed-beanie-yupoong-1501kc |
| Bags & Accessories | Cotton Color Tote Bag — Westford Mill W101 | All colors | $10.18 | https://www.printful.com/dashboard/custom/bags/totes/cotton-color-tote-bag-westford-mill-w101 |
| Long Sleeve Shirts | Unisex Long Sleeve Tee — Bella + Canvas 3501 | All colors; sizes to confirm | $18.66 | https://www.printful.com/dashboard/custom/mens/long-sleeve-shirts/unisex-long-sleeve-tee-bella-canvas-3501 |
| Tank Tops | Men's Premium Tank Top — Cotton Heritage MC1790 | All colors; sizes to confirm | $16.62 | https://www.printful.com/dashboard/custom/mens/tank-tops/mens-premium-tank-top-cotton-heritage-mc1790 |
| Stickers & Patches | Kiss-Cut Stickers | All sizes; supplied sizes: 3 × 3, 4 × 4, 5.5 × 5.5, 15 × 3.75 | $2.34 / $2.54 / $2.74 / $5.47 respectively | https://www.printful.com/dashboard/custom/collections/bestsellers/kiss-cut-stickers |

## Proposed implementation requirements to resolve in design

### Confirmed end-to-end user flow

1. Admin maintains an expandable shared lineup of product templates, initially the nine products listed above.
2. Admin opens a new store and uploads its logo.
3. The system applies the logo to every active template using that template's product options, price, and placement.
4. The system creates the store-specific fulfillment products and branded mockup images.
5. For a brand-new store with no products, completed initial-lineup products appear in the admin listing and publish on its public storefront, with the logo visible on each product image. For a store that already has products, additions from new templates appear as drafts in admin and notify the owner; they appear publicly only after publication.
6. The store owner can hide or restore individual products.

The upload is the generation trigger for new stores. Adding a new active template is the generation trigger for existing stores with logos. Replacing the logo on an existing store remains a separate design decision.

- Save catalog product and variant IDs, decoration technique, placement, logo sizing, mockup options, and retail pricing per template.
- Use consistent artwork placement for mockups and fulfillment, preserving logo proportions.
- Generate new templates for existing stores without duplicating existing products or restoring products owners intentionally hid.
- Keep incomplete or failed generation unpublished; expose progress and retry failed items.
- Verify catalog availability, supported decoration methods, and current variant costs before activating templates.

## Open decisions

- Define whether existing hidden/draft products count as an established store for this publication rule. Determine initial-lineup publication eligibility once before generation begins, so products created earlier in the same batch do not change later products to drafts.

- Confirm handling of other variant cost differences before implementing variant pricing; the retail prices above use the exact supplied costs, including size-specific sticker costs.
- Confirm whether manual price changes apply to the shared template, individual stores, or both, and how template price changes affect existing store products.
- Include all available apparel sizes?
- Verify supported decoration methods and precise print areas for the approved initial placements. Sticker artwork sizing still needs to match each selected size.
- How should logos be adapted for light/dark products and embroidery?

## Existing mockup findings (code inspection only)

- The creation endpoint reads style selections but does not send them in its Printful request.
- Position dimensions scale the print area without considering the artwork aspect ratio.
- Print area selection uses the first printfile rather than matching the selected placement and variant.
- Live reproduction has not been completed; local service credentials and dependencies are not configured.
