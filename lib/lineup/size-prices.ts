export const priceSize = (variant: { size?: string | null }) => variant.size?.trim() || "One size";
export function sizesForPricing(variants: { size?: string | null }[]) {
  const order = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
  return [...new Set(variants.map(priceSize))].sort((a,b) => {
    const x=order.indexOf(a.toUpperCase()), y=order.indexOf(b.toUpperCase());
    return x>=0 && y>=0 ? x-y : a.localeCompare(b,undefined,{numeric:true});
  });
}
export function applySizePrice<T extends { size?: string | null; variant_id: number; retail_price: string }>(variants: T[], cents: number, size?: string | number): T[] {
  if (size !== undefined && !variants.some(v => typeof size === "number" ? v.variant_id === size : priceSize(v) === size)) throw new Error("Choose a size available for this product");
  return variants.map(v => size === undefined || (typeof size === "number" ? v.variant_id === size : priceSize(v) === size) ? {...v,retail_price:(cents/100).toFixed(2)} : v);
}
