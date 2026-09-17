import type { CatalogVariant, MockupBatch } from "./types";

// One variant produces the first color preview without waiting on every size.
export function previewFirstBatches(
  batches: MockupBatch[],
  variants: CatalogVariant[],
  enabledColors?: string[] | null,
): MockupBatch[] {
  const eligible = variants.filter(
    (v) => !enabledColors || enabledColors.includes(v.color),
  );
  const chosen =
    eligible.find((v) => v.color.toLowerCase() === "black") ??
    eligible[0] ??
    variants[0];
  const source = batches.find((b) => b.variantIds.includes(chosen?.id));
  if (!source) return batches;
  return [
    { ...source, variantIds: [chosen.id] },
    ...batches
      .map((b) => ({
        ...b,
        variantIds: b.variantIds.filter((id) => id !== chosen.id),
      }))
      .filter((b) => b.variantIds.length),
  ];
}
