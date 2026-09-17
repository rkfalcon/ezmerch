export function retailPrice(costCents: number, sticker = false): number {
  if (!Number.isInteger(costCents) || costCents < 0)
    throw new Error("Invalid cost");
  return (
    (sticker
      ? Math.round((costCents + 400) / 100)
      : Math.ceil((costCents + 800) / 100)) * 100
  );
}

export function normalizeSize(size: string): string {
  return size
    .toLowerCase()
    .replace(/["″\s]/g, "")
    .replace(/×/g, "x");
}

export function variantRetailPrice(
  size: string,
  baseCents: number,
  sizePrices: Record<string, number>,
): number {
  if (!Object.keys(sizePrices).length) return baseCents;
  const value = sizePrices[normalizeSize(size)];
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(
      `Set a retail price for size ${size} before generating this product`,
    );
  return value;
}
