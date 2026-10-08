import { productDisplayImage, type ColorVariant } from "../product-colors";
export function storeProductSummary(product: {
  id: string; published: boolean; variants: ColorVariant[] | string;
  default_color: string | null; enabled_colors: string[] | null;
  global_enabled_colors: string[] | null;
}) {
  const variants: ColorVariant[] = typeof product.variants === "string" ? JSON.parse(product.variants) : product.variants;
  // Never fall back to the previous logo's thumbnail while regeneration is pending.
  const image = productDisplayImage({...product, variants, thumbnail_url:null});
  return {id:product.id,published:product.published,image,
    variants:variants.map(({variant_id,size,retail_price})=>({variant_id,size,retail_price}))};
}
