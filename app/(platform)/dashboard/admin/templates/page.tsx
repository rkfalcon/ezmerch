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
  return <LineupTemplates templates={data as ProductTemplate[]} />;
}
