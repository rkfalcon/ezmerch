import type { Metadata } from 'next';
import { publicShareProduct } from '@/lib/public-share-product';
import { productShare } from '@/lib/product-share';

export async function generateMetadata({ params }: { params: Promise<{ storeSlug: string; productId: string }> }): Promise<Metadata> {
  const { storeSlug, productId } = await params;
  const data = await publicShareProduct(storeSlug, productId);
  if (!data) return { title: 'Product unavailable', robots: { index: false }, openGraph: { images: [] }, twitter: { images: [] } };
  const share = productShare(data.store, data.product);
  return {
    title: share.title, description: share.text, alternates: { canonical: share.url },
    openGraph: { type: 'website', title: share.title, description: share.text, url: share.url,
      siteName: data.store.name, images: [{ url: share.image, width: 1200, height: 630, alt: share.title }] },
    twitter: { card: 'summary_large_image', title: share.title, description: share.text, images: [share.image] },
  };
}
export default function ProductLayout({ children }: { children: React.ReactNode }) { return children; }
