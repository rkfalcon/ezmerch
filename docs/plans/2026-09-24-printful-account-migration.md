# Printful account migration — completed September 24, 2026

## Preflight history: accounts and credential staging

- Existing store: 17933770 (EZMerch), accessible; 244 supplier sync products including generation history.
- Destination: 18805803 (VeryMerch), accessible; empty native/API store.
- Production `PRINTFUL_API_TOKEN` and `PRINTFUL_STORE_ID` retain the existing connection.
- `PRINTFUL_NEXT_API_TOKEN` and `PRINTFUL_NEXT_STORE_ID` now contain the destination credentials. No redeployment or cutover performed.
- The user initially overwrote the existing names rather than adding NEXT names. The new values were saved under NEXT, then the original working values restored and verified via fresh Vercel export and authenticated API calls. No secrets are stored in this document.
- Destination grants orders, sync_products, file_library, and webhooks read/write. It grants product_templates/read only; the app's own templates reside in Supabase and do not require writing Printful dashboard templates.

## Inventory at preflight

34 local products (30 published, 4 draft); 41 generation jobs (32 completed, 5 failed, 4 pending); zero local orders. Inventory must be rechecked immediately before cutover.

The current store has a v2 catalog_stock_updated subscription. The destination has no webhook subscriptions. Neither store currently has a v1 order webhook configured, so order notification setup must be verified rather than assumed to exist.

## Required migration implementation

1. Snapshot products, generation jobs, template references, and any pending checkout/payment sessions. Retain old credentials for rollback. Confirm destination billing is configured with the owner.
2. Copy referenced source sync products into the destination using deterministic migration external IDs. Preserve original catalog variant IDs, actual print files/positions/options, selected technique, and retail prices. Transfer artwork via accessible original URLs rather than source-account file IDs. Verify synced=true and all destination variants/files. Store an explicit old-to-new sync product and variant mapping. Do not change public storefront records during staging.
3. Cover generation-state batch syncProducts and any unfinished mockup tasks, not just products.printful_sync_product_id. Avoid blindly regenerating artwork or changing approval/publishing/color/price preferences. Reconcile product/job changes that occurred while copying.
4. Configure and test destination stock and order webhooks using the authentication supported by the API. The current order handler's custom-header check and lack of a configured order subscription need attention before relying on it.
5. Gate new checkout and pause generation during the short final switch. Handle already-open Stripe Checkout sessions and webhook deliveries so payments carrying old sync IDs cannot be sent through the new account. Recheck orders. Switch DB mappings and runtime credentials with a rollback checkpoint; deployment alone is not atomic with a DB update.
6. Validate representative product details, prepared artwork, enabled colors/defaults/prices, mockups, shipping/cost estimation, and an unconfirmed draft order. Do not confirm/charge an order as a migration test without explicit authorization. Resume checkout/workers after validation. Retain old-account access until outstanding payments/orders are reconciled.

## Verified tooling

`scripts/printful-migration-preflight.ts` performs read-only store, product-count, token-scope, webhook, and local inventory checks. Its output excludes credentials and webhook signing keys. Temporary environment export is outside the repository with restrictive permissions.


## Completed cutover

The user confirmed billing in the destination account. Production now selects store **18805803 (VeryMerch)** via the service-role-only `fulfillment_connection` singleton. `paused=false`. The old environment credentials remain installed for already-open payment intents and historical orders; do not overwrite or revoke them until those are reconciled. New credentials live in `PRINTFUL_NEXT_*`; `PRINTFUL_CONNECTION_SWITCH=true` enables database routing, including local development.

- Copied and verified 121 referenced supplier sync products and 4,372 variants.
- Atomically rewrote fulfillment IDs across 34 products and 41 generation jobs; 30 products remained published. Exact comparison verified all prices, colors, images, default selections, approvals, and other product fields remained unchanged at cutover.
- Retained completed review images. Removed account-specific unfinished task IDs/leases so future work can restart on the new account.
- Registered order webhooks for both accounts and stock webhooks for the new account. Live authentication tests returned 200 for valid signatures/tokens and 401 for invalid ones.
- New-account DTF mockup completed with a reachable image. Cost estimation passed without placing an order.
- Live Mazellist checkout returned 200 with new-account metadata and the correct migrated sync variant; shipping was $4.95 on the tested $20 shirt. Its unconfirmed payment intent was canceled. No order was created or charged.
- Mazellist and Sunday Sauce storefronts each returned 200 with their existing seven public product links after migration.

### Issues discovered and corrected

One imported artwork file failed after a transient source-storage 429 response. The product API misleadingly reported the attached file as accepted; checking the file-library record exposed the failure. Reimported and rebound the file, preserving every variant ID, then verified matching content hashes and production options for every copied record. Hex color option case was normalized by Printful (`#FFFFFF` to `#ffffff`), with no color change.

The new account defaults availability responses to `worldwide`; the old account defaulted to `usa`. Immediately after cutover the scheduled stock refresh incorrectly marked the Staple T-Shirt and Kiss-Cut Stickers unavailable, producing five stock notification emails before correction. Both catalog and checkout availability requests now explicitly request `selling_region_name=usa`. Added regression coverage and refreshed every template's stock from the new account without artificial restock emails. These alerts were caused by the account-region mismatch, not actual loss of stock.

### Verification and recovery records

All 195 tests pass; TypeScript and migration-script lint checks pass. Production deployment includes explicit U.S. availability requests.

Migration mappings, pre-cutover snapshot, verified results, and source records are retained with private permissions outside the repository at `/Users/kelly/.codex/backups/verymerch-printful-2026-09-24`. Credentials are not in that backup. Staging and apply scripts are one-time old-to-new tools: do not rerun them against migrated inventory. Any rollback must reverse the saved mappings and switch the singleton together while paused; changing environment tokens alone is unsafe.
