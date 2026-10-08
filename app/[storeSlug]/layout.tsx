import { cache } from "react";
import { storeMetadata } from "@/lib/store-metadata";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { TenantThemeProvider } from "@/components/storefront/tenant-theme-provider";
import { CartProvider } from "@/components/storefront/cart-provider";
import { StoreHeader } from "@/components/storefront/store-header";

const loadStore = cache(async (storeSlug: string) => {
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, name, slug, brand_colors, logo_url, website_url, header_color, header_text_color, selling_enabled",
    )
    .eq("slug", storeSlug)
    .single();

  if (!store) notFound();
  return store;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  return storeMetadata(await loadStore((await params).storeSlug));
}

export default async function StoreLayout({
  params,
  children,
}: {
  params: Promise<{ storeSlug: string }>;
  children: React.ReactNode;
}) {
  const { storeSlug } = await params;
  const store = await loadStore(storeSlug);

  return (
    <TenantThemeProvider brandColors={store.brand_colors}>
      <CartProvider storeSlug={store.slug}>
        <div className="min-h-screen flex flex-col">
          <StoreHeader store={store} />
          {!store.selling_enabled && (
            <p className="border-b border-amber-200 bg-amber-50 p-3 text-center text-xs text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Store preview · Checkout will open once the owner launches this store.
            </p>
          )}
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-sm text-muted-foreground">
            <p>Powered by VeryMerch</p>
            <p className="mt-1 text-xs">
              Print-on-demand items cannot be returned or exchanged. Refunds
              only for defective or damaged items.
            </p>
          </footer>
        </div>
      </CartProvider>
    </TenantThemeProvider>
  );
}
