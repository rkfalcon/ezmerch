# First-color generation scheduling

The live worker was limited to one state transition per minute. Each product required catalog discovery, quality assessment, preview compositing, print-file creation, mockup submission/polling, download and supplier synchronization before first publication. The scheduler also demoted jobs as soon as they had an image, before their first color was published.

Changes: four sequential transitions per invocation, with a 20-second budget checked before claiming each step. This is a claim budget, not cancellation of an in-flight provider operation; existing request timeouts remain. No new parallel work. Provider quota backoff, stock backoff, global lease and state patch writes remain unchanged. Priority is now unpublished first color, then available mockups that can finish publication, then remaining colors.

Verification: test-first worker cap regression; PGlite first-publication priority and lease exclusion; 124 full tests passing; TypeScript and scoped ESLint pass. Live claim function inspected after migration. Production deployment READY, www.ezmerch.store alias updated. Existing generation state was resumed without resetting jobs or artwork. Source review covered fairness, bounded work, unchanged rate-limit handling and publication safeguards. Physical samples and mobile UI were not part of this scheduling change.
