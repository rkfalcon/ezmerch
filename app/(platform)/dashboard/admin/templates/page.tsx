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
    { thumbnail_url: string | null; colors: string[] }
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
  return (
    <LineupTemplates
      templates={data as ProductTemplate[]}
      previews={previews}
    />
  );
}
