import { PrintfulClient } from './printful';
import { defaultTechnique, stockTechnique } from './catalog-techniques';
export interface TechniquePrices {
  currency: string;
  variants: { id: number; techniques: { technique_key: string; price: string }[] }[];
}
/** Alternate techniques must never inherit the default technique's price. */
export async function techniqueCatalog(id: number, technique: string, client = new PrintfulClient()) {
  const catalog = await client.product(id);
  const selected = stockTechnique(technique, catalog.product);
  if (selected && !catalog.product.techniques?.some(t => t.key.toLowerCase() === selected))
    throw new Error('This product does not support the selected technique.');
  if (!selected || selected === defaultTechnique(catalog.product)?.key.toLowerCase()) return catalog;
  const prices = await client.request<TechniquePrices>(`/v2/catalog-products/${id}/prices?currency=USD`);
  const byId = new Map(prices.variants.map(v => [v.id, v.techniques.find(t => t.technique_key === selected)?.price]));
  return {...catalog, variants: catalog.variants.map(v => ({...v, price: byId.get(v.id) ?? '', in_stock: v.in_stock && !!byId.get(v.id)}))};
}
