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
    .select("id, name, slug, brand_colors, logo_url")
    .eq("slug", storeSlug)
    .single();

  if (!store) notFound();

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", store.id)
    .eq("published", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      {/* Hero */}
      <section
        className="py-16 text-center"
        style={{ backgroundColor: store.brand_colors.primary + "10" }}
      >
        <div className="container mx-auto px-4">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="mx-auto mb-4 h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div
              className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-white"
              style={{ backgroundColor: store.brand_colors.primary }}
            >
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-3xl font-bold">{store.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Shop our collection of custom merchandise
          </p>
        </div>
      </section>

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
