import { colorName } from '../product-colors';
export const MAX_PRODUCT_COLORS = 25;

export function templateColors(variants: {color?: string | null}[], selected?: string[] | null) {
  const available = [...new Set(variants.map(colorName))];
  const saved = selected?.filter(c => available.includes(c));
  if (saved?.length) return [...new Set(saved)].slice(0, MAX_PRODUCT_COLORS);
  const preferred = ['Black', 'White', 'Navy'].filter(c => available.includes(c));
  return [...new Set([...preferred, ...available])].slice(0, MAX_PRODUCT_COLORS);
}

export function assertColorLimit(colors: string[]) {
  if (new Set(colors).size > MAX_PRODUCT_COLORS)
    throw new Error(`Enable no more than ${MAX_PRODUCT_COLORS} colors per product. Disable a color before adding another.`);
}
