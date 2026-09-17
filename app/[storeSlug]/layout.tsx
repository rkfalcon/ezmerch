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
      "id, name, slug, brand_colors, logo_url, header_color, header_text_color, selling_enabled",
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
            <p className="bg-amber-50 p-3 text-center text-sm text-amber-950">
              Store preview · Checkout will open once the owner finishes payment
              setup.
            </p>
          )}
          <main className="flex-1">{children}</main>
          <footer className="border-t py-6 text-center text-sm text-muted-foreground">
            <p>Powered by EZMerch</p>
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
