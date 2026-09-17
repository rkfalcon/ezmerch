export interface CatalogInsight {
  colors?: { name: string; hex: string | null; secondary: string | null }[] | null;
  price: number | null;
  currency: string;
  delivery: { minDate: string; maxDate: string; variant: string } | null;
}
export function startingCost(variants: { price: string; in_stock: boolean }[]) {
  const prices = variants.filter((v) => v.in_stock).map((v) => Number(v.price)).filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}
export function fastestRate(rates: { minDeliveryDate?: string | null; maxDeliveryDate?: string | null }[]) {
  return rates.filter((r) => r.minDeliveryDate && r.maxDeliveryDate)
    .sort((a, b) => a.minDeliveryDate!.localeCompare(b.minDeliveryDate!) || a.maxDeliveryDate!.localeCompare(b.maxDeliveryDate!))[0];
}
export function compareDelivery(a?: CatalogInsight, b?: CatalogInsight) {
  return (a?.delivery?.minDate ?? "9999").localeCompare(b?.delivery?.minDate ?? "9999") ||
    (a?.delivery?.maxDate ?? "9999").localeCompare(b?.delivery?.maxDate ?? "9999");
}

export function availableCatalogColors(variants: { in_stock: boolean; color?: string | null; color_code?: string | null; color_code2?: string | null }[]) {
  const hex = (value?: string | null) => value && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
  const colors = new Map<string, { name: string; hex: string | null; secondary: string | null }>();
  for (const variant of variants) {
    const name = variant.color?.trim();
    if (variant.in_stock && name && !colors.has(name)) colors.set(name, { name, hex: hex(variant.color_code), secondary: hex(variant.color_code2) });
  }
  return [...colors.values()];
}
