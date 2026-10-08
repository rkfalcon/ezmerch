# Owner notification after artwork approval

Previously, new draft products received a ready notice and completed lineups could receive a completion notice, but restoring an existing product after admin artwork approval had no dedicated owner email.

The production migration `20260924190000_review_approved_owner_email.sql` tracks new manual review approvals and queues an owner notification when the corresponding product is published, globally enabled, and has at least one owner-enabled, globally allowed, in-stock variant with current artwork, a mockup, and a fulfillment sync ID. Drafts wait for publication. Pending artwork and disabled or stock-held products do not announce availability. The message identifies the product and store and links to the Products dashboard. It uses the existing email outbox, retry delivery, and provider idempotency.

The event key includes job, generation, and approval timestamp. Repeated worker steps, product saves, and publication toggles do not duplicate an approval email. A later generation clears the approval marker. Historical approvals are not backfilled or emailed on deployment.

Validation: 189 tests passed, including lifecycle assertions for readiness, draft/global/stock/color holds, deduplication, and a new generation. A production transaction verified that approval followed by a ready product update creates exactly one notification and email outbox record. It then rolled back all changes, so no test email went to the actual owner. Email delivery itself uses the unchanged existing delivery service.
