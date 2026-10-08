# Personalized new-product emails

The existing publish_lineup_progress / complete_lineup_job notification outbox is retained: each new draft product queues one notification per owner/admin after real branded images and variants are generated. Unique recipient/product keys and Resend idempotency keys remain in place. Saving a template alone does not falsely announce that each store's artwork is ready.

The delivery worker enriches new-product notifications with the store's name and slug, product title, branded thumbnail, a dashboard call to action with Publish product instructions, and an explicit storefront link. HTML and plain text are provided. Product lookup is constrained by both product and store ID. Missing previews fail for retry rather than sending an incomplete announcement. User-controlled strings are escaped and image URLs require HTTPS. Already-published products get different instructions.

Production email delivery and background jobs were confirmed enabled without exposing credentials. The current DTF Classic Dad Hat completed for Demo Store; its existing plain-text notifications were already sent and were not resent. Three other stores were held for small lettering and should receive their new-product emails only after resolving the hold and generation succeeds.

163 tests passed; TypeScript and scoped lint passed. Email tests cover personalized links/image, escaping, invalid URLs and already-published wording. No real test emails or duplicate announcements were sent during verification.
