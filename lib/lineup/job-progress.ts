import type { GenerationState } from "./types";

/** Counts colors only when every eligible size has a rendered image. */
export function jobProgress(state: GenerationState, status: string) {
  const variants = state.variants ?? [];
  const batches = state.batches ?? [];
  const rendered = new Set(batches.flatMap(b => (b.images ?? []).flatMap(i => i.variant_ids)));
  const colors = [...new Set(variants.map(v => v.color))];
  const readyColors = colors.filter(color => variants.filter(v => v.color === color).every(v => rendered.has(v.id))).length;
  const firstPublished = status === "completed" || (state.publishedVariantCount ?? 0) > 0;
  const stage = status === "completed" ? "All colors ready"
    : status === "failed" ? "VeryMerch is reviewing the artwork"
    : firstPublished ? "First color ready · Preparing remaining colors"
    : readyColors > 0 ? "Preview ready · Preparing product for sale"
    : batches.some(b => b.taskKey) ? "Rendering first color"
    : state.printQuality ? "Preparing first color"
    : "Checking artwork and choosing placement";
  return { stage, firstPublished, readyColors, totalColors: colors.length };
}
export type JobProgress = ReturnType<typeof jobProgress>;
