import type { GenerationState } from "@/lib/lineup/types";
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
  const { data: job } = !sample ? await db.from("product_generation_jobs")
    .select("state,status").eq("template_id", id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle() : { data: null };
  const state = job?.state as GenerationState | undefined;
  const readyImages = state?.batches?.flatMap((batch) => batch.images ?? []) ?? [];
  const partialVariants: ColorVariant[] = (state?.variants ?? []).map((v) => ({
    variant_id: v.id, color: v.color, size: v.size, name: v.name, retail_price: v.price,
    image_url: readyImages.find((image) => image.variant_ids.includes(v.id))?.url,
  }));
  const hasMockups = Boolean(sample || readyImages.length);
  const sampleVariants: ColorVariant[] = sample
    ? typeof sample.variants === "string"
      ? JSON.parse(sample.variants)
      : sample.variants
    : partialVariants;
  const variants = catalog.variants.map((v) => ({
    variant_id: v.id,
    name: v.name,
    size: v.size,
    color: v.color,
    retail_price: v.price,
    image_url:
      sampleVariants.find((s) => s.variant_id === v.id)?.image_url ??
      sampleVariants.find((s) => colorName(s) === colorName(v))?.image_url ??
      (!hasMockups ? v.image : undefined),
  }));
  return {
    ...template,
    variants,
    thumbnail_url: sample?.thumbnail_url ?? readyImages[0]?.url ?? catalog.product.image,
    preview_source: hasMockups ? "sample" : "catalog",
    generation_progress: !sample && state?.batches ? `${state.batches.filter((b) => b.images).length} of ${state.batches.length} mockup batches complete. Remaining colors are still generating.` : null,
  };
}
