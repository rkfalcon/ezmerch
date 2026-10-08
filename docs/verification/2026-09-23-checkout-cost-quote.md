# Checkout fulfillment quote fix

The live fulfillment estimate returned numeric USD amounts, while checkout accepted only strings. This caused the cost-validation step to return 503 before creating a payment intent.

Updated monetary parsing and response types to accept numbers and strings, retaining malformed, negative, sub-cent, and unsafe-value rejection.

Verification:
- Regression test failed before the fix and passed afterward.
- Live estimate-only reproduction for an existing Mazellist hoodie succeeded after the fix: production 2463 cents, shipping 879 cents. No order or payment was submitted.
- All 149 tests passed; TypeScript passed.

The earlier tests mocked string amounts exclusively; numeric provider responses now have regression coverage.
