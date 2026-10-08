import type { createAdminClient } from "../supabase/admin";

/** Supplier metadata for visual previews only. Fulfillment still checks live data. */
export async function previewMetadata<T>(
  db: ReturnType<typeof createAdminClient>, key: string, load: () => Promise<T>,
): Promise<T> {
  const { data } = await db.from("lineup_preview_templates")
    .select("payload,updated_at").eq("id", key).maybeSingle();
  if (data && Date.now() - Date.parse(data.updated_at) < 86400000)
    return data.payload as T;
  const payload = await load();
  const { error } = await db.from("lineup_preview_templates").upsert({
    id: key, payload, updated_at: new Date().toISOString(),
  });
  if (error) console.warn("Preview cache write failed", error.code);
  return payload;
}
