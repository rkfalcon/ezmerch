# VeryMerch cutover

Production deployed September 23, 2026. User confirmed Supabase URL changes.
Visible app copy and generated links now use VeryMerch. Production NEXT_PUBLIC_SITE_URL updated.
Legacy GET/HEAD pages redirect with path/query preserved. API endpoints, auth callbacks, and password reset pages remain reachable during transition.
Both Stripe webhook destinations updated in place; events and secrets preserved. New payment domain registered.
Stripe platform public business details still require a Dashboard update by the user.
Resend sensitive key and sender supplied by user deployed; outbound delivery has not been tested.
148 tests and TypeScript passed. Live browser verified homepage, login, storefront and product branding.
Curl verified legacy redirect and unsigned webhook responses without redirects.
No paid transaction or outbound test email performed.
Internal idempotency keys, fulfillment IDs and browser storage keys preserved.
