# Unavailable bottle placeholder

Mazellist's water bottle job remains pending with "No available variants for this product".
Live Printful catalog verification: sole White variant in_stock=false, discontinued=false.
The worker already retries stock holds every six hours. Onboarding omitted last_error
and public preview cards ignored it, so a stock hold appeared as ordinary preparation.

Read last_error on both display paths. Hide stock-held generation cards from the public
storefront, and explain the unavailable state in onboarding. Keep automatic retries.
No template disabling or supplier writes were performed.

Verification: 93 tests pass; TypeScript passes; scoped lint has zero errors and two existing
raw-image warnings. Deployment: ezmerch-kjlmmngod-9i9e.vercel.app.
