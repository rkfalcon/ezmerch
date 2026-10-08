import { ImageResponse } from 'next/og';
import sharp from 'sharp';
import { publicShareProduct } from '@/lib/public-share-product';
import { productTitle } from '@/lib/product-title';

export async function GET(request: Request, { params }: { params: Promise<{ storeSlug: string; productId: string }> }) {
  const { storeSlug, productId } = await params;
  const data = await publicShareProduct(storeSlug, productId);
  if (!data) return new Response('Product unavailable', { status: 404 });
  const square = new URL(request.url).searchParams.get('format') === 'square';
  const width = square ? 1080 : 1200, height = square ? 1080 : 630;
  let image: string | null = null;
  if (data.image) {
    try {
      const url = new URL(data.image);
      const storageHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname;
      if (url.protocol !== 'https:' || url.username || url.password ||
          !(url.hostname === storageHost || url.hostname.endsWith('.printful.com') ||
          ['printful-upload.s3-accelerate.amazonaws.com', 'printful-upload.s3.amazonaws.com'].includes(url.hostname))) throw new Error('Unsupported image host');
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error('Image unavailable');
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 20_000_000) throw new Error('Image too large');
      const png = await sharp(Buffer.from(bytes), { limitInputPixels: 25_000_000 }).resize(800, 800, { fit: 'inside' }).png().toBuffer();
      image = `data:image/png;base64,${png.toString('base64')}`;
    } catch {
      return new Response('Preview temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  }
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: square ? 'column' : 'row', background: '#fff', color: '#171717', padding: 40, gap: 30, alignItems: 'center' }}>
      {image && <img src={image} alt="" width={square ? 740 : 550} height={square ? 740 : 550} style={{ objectFit: 'contain' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'center', gap: 18, textAlign: square ? 'center' : 'left' }}>
        <div style={{ fontSize: 30, color: '#555' }}>{data.store.name.slice(0, 100)}</div>
        <div style={{ fontSize: square ? 38 : 44, fontWeight: 700 }}>{productTitle(data.product.title).slice(0, 140)}</div>
        <div style={{ fontSize: 22, color: '#555' }}>Shop at VeryMerch.com</div>
      </div>
    </div>,
    { width, height, headers: { 'Cache-Control': 'public, max-age=300', ...(new URL(request.url).searchParams.has('download') ? { 'Content-Disposition': 'attachment; filename="product-share.png"' } : {}) } },
  );
}
