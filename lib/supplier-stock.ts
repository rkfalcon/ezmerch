export interface SupplierStock {
  discontinued: boolean;
  unavailable: number[];
  available?: number[];
  checkedAt: string;
}
export function inStock<T extends { variant_id: number }>(
  variants: T[],
  stock?: SupplierStock | null,
): T[] {
  if (!stock) return variants;
  if (stock.discontinued) return [];
  const unavailable = new Set(stock.unavailable);
  return variants.filter(
    (v) =>
      !unavailable.has(v.variant_id) &&
      (!stock.available || stock.available.includes(v.variant_id)),
  );
}
