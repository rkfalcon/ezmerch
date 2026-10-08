import { normalizeSize } from "./pricing";

export function minimumPrice(size: string | null | undefined, template: {
  retail_price_cents: number;
  size_prices: Record<string, number> | null;
}) {
  return template.size_prices?.[normalizeSize(size || "One size")] ?? template.retail_price_cents;
}
export function assertMinimumPrices(
  variants: {size?: string | null; retail_price: string}[],
  template: Parameters<typeof minimumPrice>[1],
) {
  for (const variant of variants) {
    const minimum = minimumPrice(variant.size, template);
    if (!Number.isFinite(Number(variant.retail_price)) || Number(variant.retail_price) * 100 < minimum - 0.00001)
      throw new Error(`Minimum price for ${variant.size || "One size"} is $${(minimum / 100).toFixed(2)}, as set by the admin.`);
  }
}
