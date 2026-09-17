# Product lineup setup and verification

This feature extends the existing Supabase project. It does not create a new database or replace any stores, products, users, or orders.

## Environment

Copy `.env.example` to `.env.local` for local development and provide the existing project's credentials. Add the same settings to the deployment environment. The Printful token must have catalog/mockup and store-product access for the configured Printful store. Stripe settings remain the existing application's settings.

Email delivery is deferred. Keep `LINEUP_EMAIL_ENABLED=false`; dashboard notifications remain enabled and the email outbox is left untouched. To enable delivery later, configure Resend with `RESEND_API_KEY` and a verified `NOTIFICATION_FROM_EMAIL`, then set `LINEUP_EMAIL_ENABLED=true`. Enabling delivery processes pending outbox entries, including older notifications. `NEXT_PUBLIC_SITE_URL` must be the canonical HTTPS site URL in production.

## Database

Apply `supabase/migrations/20260914190719_product_template_lineup.sql` to the existing database after testing it in a staging copy. The migration adds tables, triggers, service-only queue functions, and the public `lineup-assets` storage bucket. Existing records remain intact. New table grants are explicit; tenant/recipient reads are protected by RLS. Storage writes are server-only; logo and mockup files are public so Printful can fetch them.

Nine inactive presets are seeded with the selected products and prices. In **Admin → Product templates**, choose **Activate inactive templates** to resolve real Printful catalog IDs and validate available variants and print placements. Any unresolved product stays inactive with an actionable error; edit it and choose the exact catalog item. No catalog IDs are guessed.

## Background processing

The included `vercel.json` schedules the authenticated worker every minute on the existing Vercel Pro team. Production must have `CRON_SECRET` configured. Cron becomes active with the production deployment. Alternative schedules below are available if hosting changes; use only one schedule:

1. **Supabase Cron:** In the existing project's Cron dashboard, schedule an HTTP GET every minute to `https://YOUR_SITE/api/cron/lineup` with `Authorization: Bearer YOUR_CRON_SECRET`. Store the secret in Supabase Vault; do not put it in tracked SQL. Set an HTTP timeout sufficient for the worker route (up to 300 seconds). See [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart).
2. **Vercel Pro/Enterprise Cron:** Add `{"crons":[{"path":"/api/cron/lineup","schedule":"* * * * *"}]}` to `vercel.json`. Vercel supplies the bearer header using `CRON_SECRET`. Hobby schedules cannot run every minute and would reject that deployment configuration; see [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
3. **Supervised worker:** Run `npm run lineup:worker` with environment configuration on an always-on host. For a single development tick, run `npm run lineup:worker -- --once`.

Uploads, retries, and template activation also start a bounded initial worker pass. That pass alone is not a substitute for the recurring schedule. The durable queue prevents duplicate store/template jobs and serializes active Printful work across instances. Polling state survives process restarts. Printful products use stable external IDs, and generated mockups are copied into Supabase Storage rather than depending on expiring Printful URLs.

## Store workflow

- Open **Admin → Stores → a store**. Upload its logo (PNG/JPG/WebP, up to 4 MB). Existing stores should also upload their logo through this control so the worker has a verified normalized asset.
- Empty stores receive the whole active lineup live after successful generation. A store with any existing products, including hidden/draft products, receives additions as drafts. Eligibility is captured when work is queued, before the first generated product appears.
- The admin page displays job progress and errors. **Retry** resumes failed jobs from their saved stage. Retry does not overwrite existing products, prices, or visibility choices.
- New templates automatically enqueue new products for stores with normalized logos. Existing-store additions notify the owner and every admin through dashboard notifications and email once the draft is ready. Unclaimed stores notify admins only.
- Store owners publish/hide using the product status control. Admins can edit retail prices for all variants or an individual variant. Storefront prices are authoritative; template edits affect future generation only.
- Replacing a store logo changes branding and future generation; it does not overwrite previously generated products or in-flight snapshots.
- Deactivating a template pauses its queued work and prevents future rollout. Already generated products stay as they are.

## Operational checks

### Product previews and color availability

Admins and store owners can click a product image or name in the Products table to open its large mockup preview. Click a color name to preview it, check the colors to offer, then choose **Save enabled colors**. All sizes within an enabled color remain available. Disabled colors disappear from storefront choices and are rejected during checkout, including older carts. Catalog variants and images are preserved for re-enabling later. At least one color must stay enabled; use the product visibility control to hide the whole product.

Apply `20260915144718_product_enabled_colors.sql` before deploying these controls. Existing products default to all colors enabled. The API checks the current admin role or store ownership before allowing either reads or writes. The owner Products page resolves current store ownership from the database.

Verification included a browser fixture with real Black/White mockup URLs: switching images, saving, reopening, rejecting an empty selection, and mobile layout. API requests without authentication return 403. Automated tests cover color filtering, all sizes, unknown selections, default availability, and the database constraint. No live store color choices were changed during verification.

`product_generation_jobs` contains persisted progress, attempts, and errors. Five consecutive failures require an admin retry. `notification_emails` tracks email attempts; check it for failed deliveries after configuring a verified sender. Resend idempotency keys avoid duplicate emails during ordinary retries.

## Verification

Run `npm test`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

On a staging store, activate a single template and upload a transparent test logo. Verify branded images in admin and public views, all available variants, and the requested retail prices. Add a second template after the first product exists: it must be a draft, absent publicly, with notifications for the owner and admins. Publish/hide it and verify public visibility. Retry a forced generation failure and confirm there is one local product and one Printful sync product. Check that selected color images match the actual variant and confirm Printful's saved artwork placement before any real customer order.

Automated tests use local PGlite for SQL lifecycle/RLS and fake HTTP for external boundaries; they do not send emails, create real Printful products, or place orders. Live integration verification requires the configured staging services.

## Deployment verification — September 14, 2026

The additive migration was applied to the existing EZMerch Supabase project and recorded in migration history. Vercel production has a generated CRON_SECRET and LINEUP_EMAIL_ENABLED=false. The prior server-key setting contained a publishable key; it was corrected using the existing project's server-only credential. No secrets are tracked.

The worker endpoint returns 401 without authorization and 200 with authorization, with an empty queue. The eight automated tests and production build pass. Repository-wide lint still reports the pre-existing cart-provider set-state-in-effect error; new code has no lint errors. Supabase security advisors reported warnings in existing functions and auth settings, not the new lineup functions.

Nine templates are seeded but inactive. Real product generation and visual mockup approval still require activating templates and uploading the store logo. No real Printful products or customer orders were created during worker deployment verification. Email delivery remains deferred.

## Global availability and template previews (September 16, 2026)

Product Templates now shows generated sample-logo thumbnails and a color summary.
Click the image/name to preview colors and save the globally enabled colors; the
Enable/Disable globally button controls the entire template across existing and
future stores. Sample images come from a generated store product, so each actual
store still uses its own logo. Catalog colors without a generated mockup show an
explicit unavailable-preview message rather than an incorrectly recolored image.

Store product controls keep their own publication and color selections. Global
limits override those selections in storefront listings, product details, and
checkout, without overwriting them. Re-enabling a template or color globally
restores only the choices each store had already enabled. Global-disabled options
are marked and locked in store controls. Legacy products without templates remain
independent.

Migration `20260916204818_global_product_availability.sql` adds template color
limits and database-maintained global availability fields on products. Triggers
propagate global changes atomically and derive the fields on every product write,
including worker completion. Template associations are immutable after product
creation. The public product read policy also excludes globally disabled products.

Verification: 14 automated tests pass, including two-store preference preservation,
new products inheriting global limits, and attempts to forge derived fields. The
production build passes. Browser checks using real mockup images and mocked API
responses cover global color saving/reopening, color preview switching, locked
store colors, and mobile layout. A rolled-back production transaction verified
propagation and anonymous read restrictions without changing live selections.
All nine live templates have generated sample thumbnails; two catalog colors have
no generated sample yet and display the explicit preview-unavailable message.
Email delivery remains deferred.

Store product tables now show the same color availability pills as Product Templates.
Enabled products and colors use green; disabled products and colors use red with
minus markers and crossed-out color names. Labels and pill descriptions distinguish
global restrictions from local choices. Product rows also appear disabled when no
colors remain purchasable. Visibility changes refresh the full row and its pills.
Desktop and mobile fixture checks covered enabled, locally hidden, globally disabled,
and mixed global/local color selections; the mobile layout had no page overflow.

Storefront product details use Color and Size dropdowns instead of a button for
every color/size combination. Color changes preserve the selected size when it
exists in the new color, otherwise select an available variant. The mockup, price,
and cart entry follow the selected variant. Existing global/store color filtering
still applies. Browser verification against Demo Store data covered color image
changes, size retention/fallback, the White / 3XL cart entry, and mobile layout.

## Storefront banner settings (September 16, 2026)

Store owners can use Settings → Storefront banner; platform admins use the store's
Settings tab. A native color picker and hex input set the banner background, and a
240-character text field edits the subtitle below the store name. Empty text hides
the subtitle. The shared live preview matches the storefront, with automatic black
or white text for contrast. Save banner updates only those banner fields.

Migration `20260916211607_store_banner_settings.sql` adds nullable banner_color and
banner_subtitle to the existing stores table, with color/length constraints. Nulls
retain the previous primary-color tint and default subtitle. The server action
checks current ownership or platform-admin access before writing and revalidates
the store and settings pages. Owner settings also resolve ownership when a valid
session lacks a store ID claim.

Verification: 16 tests, TypeScript and build; browser checks for live color/text
preview, mobile layout, hidden empty subtitle, and unauthenticated save denial.
A rolled-back live database transaction verified persistence without changing the
Demo Store's banner. Authenticated saves use the existing store access check.

The same settings section is now named **Storefront header and banner**. It includes
Header background color and Header text color pickers. Header text applies to the
store name, Products link, and Cart button on every storefront page. Uncheck
Automatically choose readable banner text to select a custom Banner text color;
checking it again restores automatic contrast. Save appearance writes all choices
through the existing owner/admin-authorized action. Existing clients saving only
banner settings do not overwrite the new header colors.

Migration `20260916212141_store_header_colors.sql` adds nullable, hex-validated
header_color, header_text_color, and banner_text_color fields. Verification: all
17 tests and the production build pass; browser checks confirmed real header link
color inheritance, manual banner text, automatic reset, and mobile preview. A
rolled-back database write confirmed persistence without changing store choices.

Checkout drawer fix: clicking Checkout previously navigated within the shared
store layout without closing its cart modal, leaving the checkout form behind an
inert, blurred overlay. CartSheet now controls its open state and closes from the
checkout link, which is a single styled anchor rather than a nested button/link.
Browser reproduction confirmed the original live issue. Verification covers the
product-to-checkout transition, editable checkout fields, and reopening the cart
and clicking Checkout again on the same page at mobile width. No payment submitted.

Store-specific default image: open a product preview from a store's Products
section, preview an enabled color, click **Use this color as default image**, then
**Save product choices**. This updates the storefront card, initial product-page
color, and admin thumbnail for that store only. **Use automatic default** resets
it. Disabled colors cannot be newly selected; if a saved default is disabled
locally or globally later, display falls back to an enabled color while retaining
the preference for re-enablement. The existing owner/admin-authorized colors API
validates the chosen color and requires a generated mockup.

Migration `20260917011458_product_default_color.sql` adds nullable default_color.
Verification: 18 tests and TypeScript; browser fixture checks cover choosing,
saving, reopening, automatic reset, disabled-color prevention, storefront card
selection, and mobile layout. Browser saves were mocked, leaving live store
preferences untouched.
