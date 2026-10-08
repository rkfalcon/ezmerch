# Disabled dates and Dad Hat review

Added database-maintained template disabled_at and product global_disabled_at. Dates propagate with existing global availability updates, remain stable across repeated disable writes, and clear when reactivated. Historical disables stay unknown because no reliable timestamp was recorded. Dashboard generation entries now use the same red disabled styling as product rows and templates; all three show dates.

Verification: 165 tests passed, TypeScript passed, scoped ESLint passed with two existing image warnings. Applied only the new date migration using the linked database query CLI.

Read-only live Dad Hat diagnosis: DTF template 4c9df874-1e15-413c-a0a4-c321030093f5 uses a 1500x600 pixel print area at 300 PPI (5x2 inches). At 80% height, Sunday Sauce lettering is estimated at 0.73152 mm and Mazellist at 1.05664 mm. The internal print lettering floor is 2.032 mm. At 100% height they would be 0.9144 and 1.3208 mm respectively. These are estimates, not supplier rejections.

Demo Store's completed job has no printQuality assessment or logo quality metadata sidecar. worker.ts runs this assessment only for /logos/quality- paths; its legacy artwork bypassed that branch. Demo approval must not be interpreted as passing equivalent screening. No held products were manually approved, no thresholds changed, and no legacy artwork was regenerated as part of this dashboard change.
