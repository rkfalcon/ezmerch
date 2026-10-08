import type { CatalogProduct } from './types';
const printing = ['DTG', 'DTFILM', 'SUBLIMATION', 'CUT-SEW', 'DIRECT-TO-FABRIC', 'UV', 'DIGITAL'];
export function defaultTechnique(product: CatalogProduct) {
  return product.techniques?.find(t => t.is_default);
}
export function techniqueLabel(key: string, fallback?: string) {
  return key.toUpperCase() === 'DTFILM' ? 'DTFlex / DTF printing' : fallback ?? key;
}
export function selectedTechnique(product: CatalogProduct, filter = 'all') {
  const techniques = product.techniques ?? [];
  if (filter === 'all') return defaultTechnique(product);
  const matches = techniques.filter(t => filter === 'non-embroidery'
    ? printing.includes(t.key.toUpperCase()) : t.key.toUpperCase() === filter.toUpperCase());
  return matches.find(t => t.is_default) ?? matches[0];
}
export function matchesTechnique(product: CatalogProduct, filter: string) {
  return filter === 'all' || !!selectedTechnique(product, filter);
}
export function templateTechnique(product: CatalogProduct, filter = 'all') {
  return selectedTechnique(product, filter)?.key.toLowerCase() ?? 'dtg';
}
/** Legacy dtg templates used the catalog default, including non-DTG products. */
export function explicitTechnique(technique: string) {
  return technique === 'dtg' || technique === 'sublimation' ? undefined : technique.toUpperCase();
}
export function stockTechnique(technique: string, product: Pick<CatalogProduct, 'techniques'>) {
  return (explicitTechnique(technique) ?? defaultTechnique(product as CatalogProduct)?.key)?.toLowerCase();
}
