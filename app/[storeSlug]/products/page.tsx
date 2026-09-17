import { permanentRedirect } from "next/navigation";

export default async function StoreProductsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  permanentRedirect(`/${encodeURIComponent(storeSlug)}#products`);
}
