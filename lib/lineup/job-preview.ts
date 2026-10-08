import type { GenerationState, ProductTemplate } from "./types";

/** Never fall back to the original placement after the approved design changes. */
export function jobPreview(
  state: GenerationState,
  template: Pick<ProductTemplate, "scale" | "placement">,
  quickPreview?: string | null,
  quickPlan?: GenerationState["artworkPlan"] | null,
) {
  const mockup = state.batches?.flatMap((b) =>
    b.images?.length ? b.images : b.downloadedImages ?? [],
  )[0]?.url;
  if (mockup) return { image: mockup, imageKind: "mockup" as const };
  const effective = state.artworkPlan ?? template;
  if (state.instantPreview && state.instantPreviewPlan &&
    state.instantPreviewPlan.scale === Number(effective.scale) &&
    state.instantPreviewPlan.placement === effective.placement)
    return { image: state.instantPreview, imageKind: "placement" as const };
  const previewPlan = quickPlan ?? template;
  const changed = state.embroideryLogoPath || (state.artworkPlan && (
    state.artworkPlan.scale !== Number(previewPlan.scale) ||
    state.artworkPlan.placement !== previewPlan.placement
  ));
  return {
    image: changed ? null : quickPreview ?? null,
    imageKind: "approximate" as const,
  };
}
