import type { GenerationState } from "./types";

/** Keep resumable identifiers and artwork, not unused provider response metadata. */
export function compactGenerationState(
  state: GenerationState,
): GenerationState {
  const sync = (products: GenerationState["syncProducts"]) =>
    products?.map((p) => ({
      sync_product: { id: p.sync_product.id },
      sync_variants: p.sync_variants.map(({ id, variant_id, synced }) => ({
        id,
        variant_id,
        synced,
      })),
    }));
  return {
    ...state,
    variants: state.variants?.map(
      ({
        id,
        product_id,
        name,
        size,
        color,
        color_code,
        image,
        price,
        in_stock,
        availability_status,
      }) => ({
        id,
        product_id,
        name,
        size,
        color,
        color_code,
        image,
        price,
        in_stock,
        availability_status,
      }),
    ),
    syncProducts: sync(state.syncProducts),
    batches: state.batches?.map((batch) => ({
      ...batch,
      syncProducts: sync(batch.syncProducts),
    })),
  };
}
