import { storefrontOrigin } from "@/lib/store-metadata";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GenerationState } from "@/lib/lineup/types";
import { StoreBanner } from "@/components/storefront/store-banner";
import { enabledVariants } from "@/lib/product-colors";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/storefront/product-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  return {
    alternates: {
      canonical: `${storefrontOrigin}/${encodeURIComponent((await params).storeSlug)}`,
    },
  };
}

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
      "id, name, slug, brand_colors, logo_url, banner_color, banner_subtitle, banner_text_color, selling_enabled",
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

  const previewCards: { id: string; title: string; image: string | null }[] =
    [];
  if (!store.selling_enabled) {
    const { data: jobs } = await createAdminClient()
      .from("product_generation_jobs")
      .select(
        "id,template_id,template_snapshot,state,product_templates!inner(active)",
      )
      .eq("store_id", store.id)
      .eq("product_templates.active", true)
      .eq("publish_on_complete", true)
      .neq("status", "completed");
    for (const job of jobs ?? []) {
      if (allProducts?.some((p) => p.template_id === job.template_id)) continue;
      const state = job.state as GenerationState;
      previewCards.push({
        id: job.id,
        title: job.template_snapshot.title,
        image:
          state.batches?.flatMap((b) => b.images ?? b.downloadedImages ?? [])[0]
            ?.url ??
          state.instantPreview ??
          null,
      });
    }
  }
  return (
    <div>
      <StoreBanner store={store} />

      {/* Products Grid */}
      <section
        id="products"
        aria-label="Products"
        className="container mx-auto scroll-mt-4 px-4 py-12"
      >
        {(products && products.length > 0) || previewCards.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products?.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storeSlug={storeSlug}
              />
            ))}
            {previewCards.map((p) => (
              <article
                key={p.id}
                className="overflow-hidden rounded-xl border p-4"
              >
                {p.image ? (
                  <img
                    src={p.image}
                    alt={`${p.title} preview with store logo`}
                    className="aspect-square w-full object-contain"
                  />
                ) : (
                  <div className="flex aspect-square items-center justify-center bg-muted text-sm">
                    Preparing preview…
                  </div>
                )}
                <h2 className="mt-3 font-medium">{p.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preview · remaining colors are being prepared
                </p>
              </article>
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
