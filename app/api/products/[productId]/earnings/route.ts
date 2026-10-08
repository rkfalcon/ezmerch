import { fulfillmentConnection } from "@/lib/printful-connection";
import { unstable_cache } from "next/cache";
import { getUserWithRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { lineupStoreAccess } from "@/lib/lineup/access";
import { earningsCatalogCosts } from "@/lib/lineup/earnings-catalog";
import { PrintfulClient } from "@/lib/lineup/printful";
import { stockTechnique } from "@/lib/lineup/catalog-techniques";

const catalogCosts = unstable_cache(async (id: number, technique: string, supplierStore: string) => {
  const client = new PrintfulClient(fetch, supplierStore);
  const catalog = await client.product(id);
  const selected = stockTechnique(technique, catalog.product);
  if (!selected) throw Error("Technique unavailable");
  const costs = await earningsCatalogCosts(client, id, selected);
  return { costs, checkedAt: new Date().toISOString() };
}, ["product-earnings-catalog-v3-inside-label"], { revalidate: 3600 });

export async function GET(_request: Request, {params}: {params: Promise<{productId: string}>}) {
  if (!await getUserWithRole()) return Response.json({error:"Sign in required"},{status:401});
  const db = createAdminClient();
  const {data: product} = await db.from("products").select("store_id,template_id,variants").eq("id",(await params).productId).single();
  if (!product) return Response.json({error:"Product unavailable"},{status:404});
  try { await lineupStoreAccess(product.store_id); } catch { return Response.json({error:"Access denied"},{status:403}); }
  try {
    const {data: template, error} = await db.from("product_templates").select("catalog_product_id,technique").eq("id",product.template_id!).single();
    if (error || !template?.catalog_product_id) throw Error("No catalog pricing");
    const estimate = await catalogCosts(template.catalog_product_id, template.technique, (await fulfillmentConnection()).store_id);
    const variants = typeof product.variants === "string" ? JSON.parse(product.variants) : product.variants;
    const costs: Record<string,number> = {};
    for (const variant of variants ?? []) if (estimate.costs[String(variant.variant_id)] !== undefined) costs[String(variant.variant_id)] = estimate.costs[String(variant.variant_id)];
    return Response.json({costs,checkedAt:estimate.checkedAt},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return Response.json({error:"Earnings estimate is temporarily unavailable. You can still edit the selling price."},{status:503}); }
}
