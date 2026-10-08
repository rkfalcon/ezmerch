import { insideLabelPlacement } from "./inside-label";
import type { CatalogProduct } from "./types";
import type { PrintfulClient } from "./printful";
import type { TechniquePrices } from "./technique-catalog";
import { dollarsToCents } from "../checkout-costs";

export async function earningsCatalogCosts(client: Pick<PrintfulClient,"request">, id: number, technique: string) {
  const { product } = await client.request<{ product: CatalogProduct }>(`/products/${id}`);
  const label = insideLabelPlacement(product);
  const labelCost = label ? dollarsToCents(label.additional_price) : 0;
  const costs: Record<string, number> = {};
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await client.request<TechniquePrices>(`/v2/catalog-products/${id}/prices?currency=USD&limit=100&offset=${offset}`);
    if (page.currency !== "USD") throw Error("Unsupported currency");
    for (const variant of page.variants) {
      const price = variant.techniques.find(t => t.technique_key.toLowerCase() === technique)?.price;
      try { costs[String(variant.id)] = dollarsToCents(price) + labelCost; } catch { /* Missing costs remain unavailable. */ }
    }
    if (page.variants.length < 100) return costs;
  }
  throw Error("Catalog pricing is incomplete");
}
