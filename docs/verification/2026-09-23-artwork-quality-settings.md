# Global artwork quality settings

Admin → Artwork quality exposes 19 numeric thresholds and 3 switches with saved values, conservative internal recommended defaults, units, explanations, bounds, restore defaults and discard controls. Print lettering uses millimeters (not nanometers); default remains 2.032 mm. No production thresholds were lowered during implementation.

Settings apply to subsequent assessment of uploaded artwork in new and existing stores. Worker placement assessment and quick preview planning read settings from the service-only singleton. Upload preparation and visual comparison caches include the policy revision, and simplified embroidery preparation is revision-scoped. Reports record their assessment revision. Existing completed jobs are not silently reassessed or published. Retry uses updated lettering/sizing/resolution rules; new image-comparison/transparency evidence requires upload again.

Database migration 20260923205233_artwork_quality_settings.sql creates RLS-enabled service-only settings and revision history. Authenticated admin API guards all reads/writes; saves validate exact fields, types, numeric ranges and alpha-boundary ordering. Revision compare-and-swap prevents overwriting concurrent edits. Database trigger writes an audit snapshot on each save. Missing/invalid settings fail processing instead of silently using defaults.

Fixed invariants are described on the page: image validity, supplier geometry/resolution, confident identity-preserving visual verdict, and flat embroidery feature checks. Model prompts, upload resource limits and image-processing internals are not mutable supplier-quality thresholds.

Validation: 170 tests pass; TypeScript and scoped ESLint pass. New tests cover full-size DTF hat acceptance at 0.90 mm, continued rejection of low resolution or altered lettering, optional DTF enlargement, invalid settings, configurable transparency, seeded defaults, RLS, audit history and stale-write protection. Live admin test verified GET/PUT, rejected non-admin access, rejected invalid and stale updates, decimal editing, discard and page rendering. Saved identical values only; test account and session removed. Screenshot: /tmp/verymerch-quality-settings.png.

Targeted manual review used because the working tree has unrelated changes; no commit created. Production deployment verified via Vercel alias.
