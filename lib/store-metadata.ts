import { siteOrigin } from "@/lib/site";
import type { Metadata } from "next";
export const storefrontOrigin = siteOrigin;
export function storeMetadata(store: {
  name: string;
  slug: string;
  logo_url: string | null;
}): Metadata {
  const title = `VeryMerch - ${store.name}`;
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
      siteName: "VeryMerch",
      title,
      description: title,
      url,
      images,
    },
    twitter: { card: "summary", title, description: title, images },
  };
}
