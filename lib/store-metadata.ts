import type { Metadata } from "next";
export const storefrontOrigin = "https://www.ezmerch.store";
export function storeMetadata(store: {
  name: string;
  slug: string;
  logo_url: string | null;
}): Metadata {
  const title = `EzMerch - ${store.name}`;
  const url = `${storefrontOrigin}/${encodeURIComponent(store.slug)}`;
  const images =
    store.logo_url && /^https?:\/\//i.test(store.logo_url)
      ? [{ url: store.logo_url, alt: `${store.name} logo` }]
      : [];
  return {
    title,
    description: title,
    openGraph: {
      type: "website",
      siteName: "EzMerch",
      title,
      description: title,
      url,
      images,
    },
    twitter: { card: "summary", title, description: title, images },
  };
}
