export const requestedGalleryStyles = ["Men's 5", "Women's 5", "Couple's"];
export interface GalleryImage { url: string; variant_ids: number[]; style: string }
export interface SupplierMockup {
  placement?: string;
  variant_ids: number[];
  mockup_url: string;
  extra?: { option: string; option_group: string; url: string }[];
}
export function galleryStyles(category: string, available: string[], primary: string[] = []): string[] {
  const preferred = category === 'Tank Tops'
    ? ["Men's 2", "Men's 3", 'Flat']
    : [...requestedGalleryStyles, "Men's", "Women's", 'Lifestyle', 'Flat', 'Product details'];
  const basic = available.filter(style => !/ghost|default|label|template|production|specs|holiday|halloween|valentine|christmas|season|spring|summer|premium|collage/i.test(style));
  return [...new Set([...preferred, ...basic])]
    .filter(style => available.includes(style) && !primary.includes(style) && (preferred.includes(style) || basic.includes(style)))
    .slice(0, 3);
}
/** Printful puts one requested style in the primary image and labels the others in extra. */
export function galleryImages(mockups: SupplierMockup[], styles: string[], representatives: {id:number;variantIds:number[]}[], placement = 'front'): GalleryImage[] {
  return mockups.flatMap(mockup => {
    if (mockup.placement && placement !== 'default' && mockup.placement !== 'default' && mockup.placement !== placement && !mockup.placement.startsWith(placement.includes('back') ? 'back' : 'front')) return [];
    const variant_ids = representatives.filter(r => mockup.variant_ids.includes(r.id)).flatMap(r => r.variantIds);
    if (!variant_ids.length) return [];
    const oppositeView = placement.includes('back') ? /front/i : /back/i;
    const extras = (mockup.extra ?? []).filter(i => styles.includes(i.option_group) && !oppositeView.test(i.option));
    const missing = styles.filter(style => !extras.some(i => i.option_group === style));
    const preferredView = placement.startsWith('back') ? 'Back' : 'Front';
    return styles.flatMap(style => {
      const candidates = extras.filter(i => i.option_group === style);
      const extra = candidates.find(i => i.option === preferredView) ?? candidates[0];
      const url = extra?.url ?? (missing.length === 1 && missing[0] === style ? mockup.mockup_url : null);
      return url ? [{url, variant_ids, style}] : [];
    });
  });
}
export function selectedGallery(primary: string | null, variantId: number | undefined, images: GalleryImage[]): GalleryImage[] {
  const candidates = [
    ...(primary ? [{url:primary,variant_ids:[],style:'Product view'}] : []),
    ...images.filter(i => variantId !== undefined && i.variant_ids.includes(variantId)),
  ];
  return candidates.filter((image, index) => candidates.findIndex(i => i.url === image.url) === index);
}
