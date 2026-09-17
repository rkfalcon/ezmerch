import { createAdminClient } from "../supabase/admin";
import { readStock, stockError } from "./availability";

export async function syncSupplierStock(limit = 3) {
  const db = createAdminClient();
  const { data: templates, error } = await db
    .from("product_templates")
    .select("id,catalog_product_id,technique")
    .not("catalog_product_id", "is", null)
    .lte("stock_next_check_at", new Date().toISOString())
    .order("stock_next_check_at")
    .limit(limit);
  if (error) throw error;
  let checked = 0;
  for (const template of templates ?? []) {
    try {
      const stock = await readStock(
        template.catalog_product_id,
        template.technique,
      );
      const { error } = await db.rpc("apply_supplier_stock", {
        p_template: template.id,
        p_stock: stock,
      });
      if (error) throw error;
      checked++;
    } catch (error) {
      const { error: saveError } = await db
        .from("product_templates")
        .update({
          stock_check_error: stockError(error),
          stock_next_check_at: new Date(Date.now() + 15 * 60_000).toISOString(),
        })
        .eq("id", template.id);
      if (saveError) throw saveError;
    }
  }
  return { checked };
}

/** Keep newly added catalog products covered without replacing the signing keys. */
export async function refreshStockSubscription() {
  if (!process.env.PRINTFUL_STOCK_WEBHOOK_SECRET) return;
  const { PrintfulClient } = await import("./printful");
  const client = new PrintfulClient();
  const config = await client.request<{
    events: {
      type: string;
      params: { name: string; value: { id: number }[] }[];
    }[];
  }>("/v2/webhooks");
  const { data, error } = await createAdminClient()
    .from("product_templates")
    .select("catalog_product_id")
    .not("catalog_product_id", "is", null);
  if (error) throw error;
  const ids = [
    ...new Set((data ?? []).map((t) => t.catalog_product_id as number)),
  ].sort((a, b) => a - b);
  const existing =
    config.events
      .find((e) => e.type === "catalog_stock_updated")
      ?.params.find((p) => p.name === "products")
      ?.value.map((p) => p.id)
      .sort((a, b) => a - b) ?? [];
  if (JSON.stringify(ids) !== JSON.stringify(existing))
    await client.request("/v2/webhooks/catalog_stock_updated", {
      url: new URL(
        "/api/webhooks/printful-stock",
        process.env.NEXT_PUBLIC_SITE_URL,
      ).href,
      params: [{ name: "products", value: ids.map((id) => ({ id })) }],
    });
}
