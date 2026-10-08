# First approved color priority

Applied production migration 20260921184855 on September 21, 2026.

The database scheduler prioritizes:
1. First publication for non-embroidery jobs and already approved embroidery.
2. Unapproved embroidery assessment/remediation.
3. Remaining colors on products with published variants.

Short supplier waits retain priority: eligible lower-priority work cannot take the global worker lease while higher-priority work is due within five minutes. Failed/completed jobs, inactive/discontinued templates, and longer retry/stock waits do not block the queue. Existing global lease exclusion, snapshot technique, and artwork approval gates remain intact. Queue wakeup uses the same priority so blocked work does not cause immediate rescheduling loops.

Verification: 138 tests passed; TypeScript passed. PGlite executes the actual migration and tests first-color ordering, lease exclusion, a 30-second supplier wait, matching wakeup, failed jobs, six-hour stock delays, and approved embroidery. Production read-only checks confirmed priorities 0/1/2, functioning next wakeup, and denied anonymous execution of the new helper.

This is a database-only deployment; existing application workers use the updated claim function. No new elapsed-time benchmark was run, and no reduction in Printful rendering time is claimed.
