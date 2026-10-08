import { createClient } from '@/lib/supabase/server';
import { defaultVariant, enabledVariants } from '@/lib/product-colors';
import { inStock } from '@/lib/supplier-stock';

export async function publicShareProduct(storeSlug: string, productId: string) {
  const db = await createClient();
  const { data: store } = await db.from('stores').select('id,name,slug').eq('slug', storeSlug).single();
  if (!store) return null;
  const { data: product } = await db.from('products')
    .select('id,title,thumbnail_url,variants,supplier_stock,enabled_colors,global_enabled_colors,default_color')
    .eq('store_id', store.id).eq('id', productId).eq('published', true).eq('global_active', true).single();
  if (!product) return null;
  const allVariants: Array<{ variant_id: number; color?: string; artwork_pending?: boolean; image_url?: string }> = typeof product.variants === 'string' ? JSON.parse(product.variants) : product.variants;
  const variants = enabledVariants(inStock(allVariants, product.supplier_stock), product.enabled_colors, product.global_enabled_colors);
  if (!variants.length) return null;
  const variant = defaultVariant(variants, product.default_color);
  return { store, product, image: variant?.image_url || product.thumbnail_url };
}
