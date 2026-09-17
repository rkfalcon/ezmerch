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

export function defaultVariant<
  T extends { color?: string | null; image_url?: string },
>(variants: T[], preferred?: string | null): T | undefined {
  return (
    variants.find((v) => colorName(v) === preferred && v.image_url) ??
    variants.find((v) => v.image_url) ??
    variants[0]
  );
}

export function productDisplayImage(product: {
  variants: { color?: string | null; image_url?: string }[] | string;
  enabled_colors?: string[] | null;
  global_enabled_colors?: string[] | null;
  default_color?: string | null;
  thumbnail_url: string | null;
}) {
  const variants: { color?: string | null; image_url?: string }[] =
    typeof product.variants === "string"
      ? JSON.parse(product.variants)
      : product.variants;
  return (
    defaultVariant(
      enabledVariants(
        variants,
        product.enabled_colors,
        product.global_enabled_colors,
      ),
      product.default_color,
    )?.image_url ?? product.thumbnail_url
  );
}

export function validateDefaultColor(
  variants: { color?: string | null; image_url?: string }[],
  value: unknown,
  colors: string[],
  globalColors?: string[] | null,
) {
  if (value === null) return null;
  if (
    typeof value !== "string" ||
    value.length > 120 ||
    !enabledVariants(variants, colors, globalColors).some(
      (v) => colorName(v) === value && v.image_url,
    )
  )
    throw new Error(
      "Choose an enabled color with a generated mockup for the default image.",
    );
  return value;
}
