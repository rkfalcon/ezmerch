import { createAdminClient } from "@/lib/supabase/admin";
import { PrintfulClient } from "@/lib/lineup/printful";
import { colorName, type ColorVariant } from "@/lib/product-colors";

export async function templatePreview(id: string) {
  const db = createAdminClient();
  const { data: template, error } = await db
    .from("product_templates")
    .select("id,title,catalog_product_id,enabled_colors,active")
    .eq("id", id)
    .single();
  if (error || !template) throw new Error("Template not found");
  if (!template.catalog_product_id)
    throw new Error("Choose a Printful product in Edit first");
  const [{ data: sample }, catalog] = await Promise.all([
    db
      .from("products")
      .select("thumbnail_url,variants")
      .eq("template_id", id)
      .not("thumbnail_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    new PrintfulClient().product(template.catalog_product_id),
  ]);
  const sampleVariants: ColorVariant[] = sample
    ? typeof sample.variants === "string"
      ? JSON.parse(sample.variants)
      : sample.variants
    : [];
  const variants = catalog.variants.map((v) => ({
    variant_id: v.id,
    name: v.name,
    size: v.size,
    color: v.color,
    retail_price: v.price,
    image_url:
      sampleVariants.find((s) => s.variant_id === v.id)?.image_url ??
      sampleVariants.find((s) => colorName(s) === colorName(v))?.image_url,
  }));
  return {
    ...template,
    variants,
    thumbnail_url: sample?.thumbnail_url ?? catalog.product.image,
    preview_source: sample ? "sample" : "catalog",
  };
}
