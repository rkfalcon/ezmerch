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

// A catalog color with the same physical print area uses one preview across sizes.
// Keep differing print areas separate so artwork proportions never cross over.
export function colorBatches(
  batches: MockupBatch[],
  variants: CatalogVariant[],
  enabledColors?: string[] | null,
): MockupBatch[] {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const groups = new Map<string, MockupBatch>();
  for (const batch of batches)
    for (const id of batch.variantIds) {
      const color = byId.get(id)?.color ?? String(id);
      const key = `${batch.printfile.printfile_id}:${color}`;
      const group = groups.get(key) ?? {
        printfile: batch.printfile,
        variantIds: [],
        representatives: [{ id, variantIds: [] }],
      };
      group.variantIds.push(id);
      group.representatives![0].variantIds.push(id);
      groups.set(key, group);
    }
  const ordered = [...groups.values()].sort((a, b) => {
    const rank = (batch: MockupBatch) => {
      const color = byId.get(batch.variantIds[0])?.color ?? "";
      return (
        (!enabledColors || enabledColors.includes(color) ? 0 : 2) +
        (color.toLowerCase() === "black" ? 0 : 1)
      );
    };
    return rank(a) - rank(b);
  });
  const first = ordered.shift();
  if (!first) return [];
  const result = [first];
  // Five colors per task, rather than five size/color combinations.
  for (const group of ordered) {
    const target = result
      .slice(1)
      .find(
        (b) =>
          b.printfile.printfile_id === group.printfile.printfile_id &&
          b.representatives!.length < 5,
      );
    if (target) {
      target.variantIds.push(...group.variantIds);
      target.representatives!.push(...group.representatives!);
    } else result.push(group);
  }
  return result;
}
