import type { GenerationState, ProductTemplate } from "./types";

/** Only untouched, held designs may be adjusted without replacing a published generation. */
export function resetReview(state: GenerationState, template: ProductTemplate, adjustment?: {scale: number; placement: string}) {
  if (state.publishedVariantCount || state.syncId || state.syncProducts?.length ||
      state.batches?.some(b => b.taskKey || b.images?.length || b.downloadedImages?.length || b.syncProducts?.length))
    throw new Error("Supplier generation has started. Replace the logo to regenerate safely.");
  const updated = {...template};
  if (adjustment) {
    if (!Number.isFinite(adjustment.scale) || adjustment.scale < 0.01 || adjustment.scale > 1)
      throw new Error("Choose a logo scale from 1 to 100 percent.");
    const allowed = new Set([template.placement]);
    if (template.technique === "dtg" && ["front", "front_left_chest"].includes(template.placement)) {
      allowed.add("front"); allowed.add("front_left_chest");
    }
    if (!allowed.has(adjustment.placement)) throw new Error("Unsupported placement for this product.");
    updated.scale = adjustment.scale;
    updated.placement = adjustment.placement;
  }
  // Re-plan from live catalog and the current color cap. Legacy held batches may
  // contain disabled colors or stale stock information.
  const fresh: GenerationState = {};
  return {state:fresh,template:updated};
}
