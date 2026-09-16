import { StoreBanner } from "@/components/storefront/store-banner";
import { enabledVariants } from "@/lib/product-colors";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";

export default async function StorePage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, name, slug, brand_colors, logo_url, banner_color, banner_subtitle",
    )
    .eq("slug", storeSlug)
    .single();

  if (!store) notFound();

  const { data: allProducts } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .eq("published", true)
    .eq("global_active", true)
    .order("created_at", { ascending: false });

  const products = allProducts?.filter(
    (product) =>
      enabledVariants(
        typeof product.variants === "string"
          ? JSON.parse(product.variants)
          : product.variants,
        product.enabled_colors,
        product.global_enabled_colors,
      ).length > 0,
  );

  return (
    <div>
      <StoreBanner store={store} />

      {/* Products Grid */}
      <section className="container mx-auto px-4 py-12">
        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storeSlug={storeSlug}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No products available yet. Check back soon!</p>
          </div>
        )}
      </section>
    </div>
  );
}
