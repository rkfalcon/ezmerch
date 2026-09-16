export interface ColorVariant {
  variant_id: number;
  name: string;
  size: string;
  color: string | null;
  retail_price: string;
  image_url?: string;
  sync_variant_id?: number;
}

export function colorName(variant: { color?: string | null }): string {
  return variant.color?.trim() || "Default";
}

export function enabledVariants<T extends { color?: string | null }>(
  variants: T[],
  colors?: string[] | null,
  globalColors?: string[] | null,
): T[] {
  return variants.filter(
    (v) =>
      (colors == null || colors.includes(colorName(v))) &&
      (globalColors == null || globalColors.includes(colorName(v))),
  );
}

export function validateColorSelection(
  variants: { color?: string | null }[],
  input: unknown,
): string[] {
  if (
    !Array.isArray(input) ||
    !input.length ||
    input.some((v) => typeof v !== "string")
  )
    throw new Error(
      "Enable at least one color. To hide the whole product, use its visibility control.",
    );
  const available = new Set(variants.map(colorName));
  if (input.some((color) => !available.has(color)))
    throw new Error("Choose colors available for this product.");
  return [...new Set(input as string[])];
}
