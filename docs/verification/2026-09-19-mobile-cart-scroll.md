# Mobile cart scroll mitigation

User reports that iPhone Chrome stops scrolling upward with top content still hidden.
Desktop Chrome at mobile width could not reproduce the iPhone failure.

The installed Base UI scroll-lock code changes body overflow and documents iOS
issues when browser chrome collapses. Removed this suspected trigger from the
storefront cart using modal="trap-focus". Focus trapping remains; backdrop uses
touch-action:none and the cart list contains overscroll. Other sheet dialogs
retain their existing modal scroll locking.

Verification: TypeScript and diff checks passed. At 393px, opening the cart after
scrolling to y=1480 leaves body/html overflow visible. Closing and scrolling up
returns to y=0 with banner at y=122. Cart-to-checkout navigation and down/up
scrolling return to y=0 with Checkout heading at y=154. No payments submitted.

Limitation: This is a targeted mitigation, not a confirmed reproduction/fix of
the physical iPhone/browser-toolbar issue. User device retest required.
