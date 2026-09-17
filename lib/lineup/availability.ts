import { PrintfulClient, PrintfulError } from "./printful";

export interface StockSnapshot {
  discontinued: boolean;
  unavailable: number[];
  available: number[];
  checkedAt: string;
}
export interface StockRow {
  catalog_variant_id: number;
  techniques: {
    technique: string;
    selling_regions: { name: string; availability: string }[];
  }[];
}
export function availableInUSA(row: StockRow, technique: string) {
  return row.techniques.some(
    (t) =>
      t.technique.toLowerCase() === technique.toLowerCase() &&
      t.selling_regions.some(
        (r) => r.name === "usa" && r.availability === "in stock",
      ),
  );
}
export async function readStock(
  productId: number,
  technique: string,
  client = new PrintfulClient(),
): Promise<StockSnapshot> {
  const catalog = await client.product(productId);
  const checkedAt = new Date().toISOString();
  if (
    catalog.product.is_discontinued ||
    catalog.variants.every((v) => v.in_stock === false)
  )
    return {
      discontinued: catalog.product.is_discontinued,
      available: [],
      unavailable: catalog.variants.map((v) => v.id).sort((a, b) => a - b),
      checkedAt,
    };
  const techniques = (
    catalog.product as typeof catalog.product & {
      techniques?: { key: string; is_default: boolean }[];
    }
  ).techniques;
  const selected =
    technique === "embroidery"
      ? "embroidery"
      : techniques?.find((t) => t.is_default)?.key.toLowerCase();
  if (!selected)
    throw new Error("Printful did not provide the product printing technique");
  const rows: StockRow[] = [];
  // Fetch every page; an incomplete response must never disable the remaining variants.
  for (let offset = 0; offset < 5000; offset += 100) {
    const page = await client.request<StockRow[]>(
      `/v2/catalog-products/${productId}/availability?limit=100&offset=${offset}`,
    );
    if (!Array.isArray(page))
      throw new Error("Invalid Printful availability response");
    rows.push(...page);
    if (page.length < 100) break;
    if (offset === 4900)
      throw new Error("Printful availability pagination limit reached");
  }
  if (!rows.length) throw new Error("Printful returned no availability data");
  const available = new Set(
    rows
      .filter((row) => availableInUSA(row, selected))
      .map((row) => row.catalog_variant_id),
  );
  return {
    discontinued: false,
    available: [...available].sort((a, b) => a - b),
    unavailable: catalog.variants
      .filter((v) => !available.has(v.id))
      .map((v) => v.id)
      .sort((a, b) => a - b),
    checkedAt,
  };
}
export function stockError(error: unknown) {
  return error instanceof PrintfulError
    ? `Printful availability check failed (${error.status}); previous stock status retained.`
    : "Availability could not be verified; previous stock status retained.";
}
