import type { CatalogProduct } from './types';

/** Only native printed labels: sewn-in/AOP labels need a different template. */
export function insideLabelPlacement(product: Pick<CatalogProduct, 'files' | 'techniques'>) {
  if (!product.techniques?.some(t => ['DTG', 'DTFILM', 'EMBROIDERY'].includes(t.key.toUpperCase()))) return undefined;
  return product.files?.find(f => f.type === 'label_inside')
    ?? product.files?.find(f => f.type === 'label_inside_dtf');
}

export function insideLabelTone(hex: string): 'black' | 'white' {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error('Missing garment color for inside label');
  const channels = [1, 3, 5].map(i => {
    const value = parseInt(hex.slice(i, i + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? 'black' : 'white';
}

export interface ProductionFile {
  url: string;
  type?: string;
  options?: { id: string; value: boolean | string }[];
}

export function brandedFiles(files: ProductionFile[], product: CatalogProduct, color: string): ProductionFile[] {
  const placement = insideLabelPlacement(product);
  if (!placement) return files;
  if (files.some(f => f.type?.startsWith('label_outside')))
    throw new Error('Outside labels conflict with the required VeryMerch inside label. Choose another placement.');
  return [...files.filter(f => !f.type?.startsWith('label_inside')), {
    type: placement.type,
    url: `https://www.verymerch.com/branding/inside-label-v2-${insideLabelTone(color)}.png`,
    options: [{ id: 'template_type', value: 'native' }],
  }];
}
