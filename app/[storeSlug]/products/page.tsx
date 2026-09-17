import { enabledVariants } from "@/lib/product-colors";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";

export default async function StoreProductsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
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
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">All Products</h1>
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
          No products available yet.
        </div>
      )}
    </div>
  );
}
