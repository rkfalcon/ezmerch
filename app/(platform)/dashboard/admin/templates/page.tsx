import { templatePreview } from "@/lib/lineup/template-preview";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { LineupTemplates } from "@/components/dashboard/lineup-templates";
import type { ProductTemplate } from "@/lib/lineup/types";

export default async function TemplatesPage() {
  await requireAdmin();
  const { data, error } = await createAdminClient()
    .from("product_templates")
    .select("*")
    .order("created_at")
    .order("title");
  if (error)
    return (
      <p role="alert">
        Product templates are unavailable. Complete the database setup before
        using this feature.
      </p>
    );
  const { data: samples } = await createAdminClient()
    .from("products")
    .select("template_id,thumbnail_url,variants")
    .not("template_id", "is", null)
    .not("thumbnail_url", "is", null)
    .order("created_at", { ascending: false });
  const previews: Record<
    string,
    { thumbnail_url: string | null; colors: string[]; catalog?: boolean }
  > = {};
  for (const sample of samples ?? []) {
    if (previews[sample.template_id]) continue;
    const variants =
      typeof sample.variants === "string"
        ? JSON.parse(sample.variants)
        : sample.variants;
    previews[sample.template_id] = {
      thumbnail_url: sample.thumbnail_url,
      colors: [
        ...new Set(
          (variants as { color?: string | null }[]).map(
            (v) => v.color?.trim() || "Default",
          ),
        ),
      ],
    };
  }
  // New templates have no generated store sample yet; show catalog imagery and colors.
  for (const template of data ?? []) {
    if (previews[template.id] || !template.catalog_product_id) continue;
    try {
      const preview = await templatePreview(template.id);
      previews[template.id] = {
        thumbnail_url: preview.thumbnail_url,
        catalog: preview.preview_source === "catalog",
        colors: [...new Set(preview.variants.map((v) => v.color?.trim() || "Default"))],
      };
    } catch {
      // A temporary catalog failure must not prevent managing other templates.
    }
  }
  return (
    <LineupTemplates
      templates={data as ProductTemplate[]}
      previews={previews}
    />
  );
}
