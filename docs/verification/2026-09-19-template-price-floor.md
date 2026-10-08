# Template minimum prices

The store price action checked positive amounts but did not load the linked template.
Added current-template server validation, owner editor minimum guidance, and a database
trigger that floors all linked product variant writes. This also covers regeneration
using older template snapshots. Template price increases raise lower existing prices;
decreases preserve store prices. Size overrides use the same normalization as generation.
Template associations cannot be removed or changed to bypass enforcement.

Applied migration 20260919173833 to production. Repaired 627 underpriced variants;
post-migration audit found zero. Existing orders are unchanged.
92 tests pass; TypeScript and scoped lint pass. Database tests cover repair, future writes,
size-specific prices, template increases/decreases and association bypass.
Security advisor produced no findings for the new functions.
Dashboard release includes minimum-price guidance and updated admin template wording.
