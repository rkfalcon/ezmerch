import { brandedFiles, type ProductionFile } from './inside-label';
import type { CatalogProduct, CatalogVariant } from './types';

export async function addInsideLabels<T extends { sync_variants: { variant_id: number; files: ProductionFile[] }[] }>(
  payload: T,
  request: <R>(path: string) => Promise<R>,
): Promise<T> {
  const catalogs = new Map<number, { product: CatalogProduct; variants: CatalogVariant[] }>();
  const variants = new Map<number, { product: CatalogProduct; variant: CatalogVariant }>();
  for (const item of payload.sync_variants) {
    if (variants.has(item.variant_id)) continue;
    const detail = await request<{ variant: CatalogVariant }>(`/products/variant/${item.variant_id}`);
    const id = detail.variant.product_id;
    let catalog = catalogs.get(id);
    if (!catalog) {
      catalog = await request<{ product: CatalogProduct; variants: CatalogVariant[] }>(`/products/${id}`);
      catalogs.set(id, catalog);
      for (const variant of catalog.variants) variants.set(variant.id, { product: catalog.product, variant });
    }
    if (!variants.has(item.variant_id)) throw new Error('Could not verify inside label compatibility');
  }
  return { ...payload, sync_variants: payload.sync_variants.map(item => {
    const { product, variant } = variants.get(item.variant_id)!;
    return { ...item, files: brandedFiles(item.files, product, variant.color_code) };
  }) };
}
