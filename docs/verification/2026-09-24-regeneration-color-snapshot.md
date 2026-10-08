# Regeneration color snapshot repair

The Mazellist Staple T-Shirt generation was completed using `enabled_colors: null` in an old template snapshot. Its default first 25 catalog colors overlapped the current admin selection by only six. The owner filter correctly hid globally disabled colors; the missing 19 colors had never been generated.

The database trigger in `20260924173000_refresh_generation_colors.sql` refreshes the snapshot's enabled colors from the current template when a job is inserted, its generation changes, or its logo changes. It retains the job's artwork placement and scale. Applied to the linked production database and recorded in migration history.

`repair-store-colors.ts` extends completed, approved generations with missing globally enabled in-stock variants. It only permits previously assessed print areas, preserves batch indexes and generation identifiers, and uses a compare-and-set update. Existing published variants remain available throughout the repair. Re-running after completion is a no-op when no colors are missing. Run without `--apply` first to inspect the proposed additions.

This does not automatically start generation merely when an admin edits template colors. It fixes future logo regeneration and repairs the affected existing Mazellist product.

Validation: 188 automated tests pass; TypeScript and targeted lint pass. Regression tests cover fresh and replaced generation snapshots, preservation of placement and existing batches, duplicate repair prevention, and rejection of unassessed print areas. Live verification scripts check all 25 current colors, image readiness, and preservation of publication, saved prices, owner color choices, and default color.

Production repair completed successfully: 19 missing colors (141 size/color variants) appended; owner-visible available colors increased from 6 to 25. The job is completed with no error. Every allowed color has a ready image. Existing retail prices, publication state, owner enabled-color preferences, and Vintage White default are unchanged. A repeated dry-run found no remaining missing colors.
