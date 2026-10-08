import { productTitle } from './product-title';
import { siteOrigin } from './site';

export function productShare(store: { name: string; slug: string }, product: { id: string; title: string }) {
  const name = productTitle(product.title);
  const url = `${siteOrigin}/${encodeURIComponent(store.slug)}/products/${encodeURIComponent(product.id)}`;
  const title = `${name} | ${store.name}`;
  const text = `Check out ${name} from ${store.name}!`;
  const caption = `${text}\n${url}`;
  return {
    title, text, caption, url,
    image: `${url}/share-image`,
    instagramImage: `${url}/share-image?format=square`,
    x: `https://twitter.com/intent/tweet?${new URLSearchParams({ text: text.slice(0, 230), url })}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url })}`,
    email: `mailto:?${new URLSearchParams({ subject: title, body: `${text}\n\nShop here: ${url}` }).toString().replace(/\+/g, '%20')}`,
  };
}
