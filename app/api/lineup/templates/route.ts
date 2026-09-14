import { after } from "next/server";
import { lineupAdmin } from "@/lib/lineup/access";
import { PrintfulClient, groupPrintfiles } from "@/lib/lineup/printful";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLineupWorker } from "@/lib/lineup/worker";
import { variantRetailPrice } from "@/lib/lineup/pricing";
import type { ProductTemplate } from "@/lib/lineup/types";

export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    await lineupAdmin();
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const db = createAdminClient();
    const client = new PrintfulClient();
    if (body.action === "activate-presets") {
      const { data, error } = await db
        .from("product_templates")
        .select("*")
        .eq("active", false);
      if (error) throw error;
      const errors: string[] = [];
      const ready: {
        id: string;
        catalog_product_id: number;
        placement: string;
      }[] = [];
      for (const template of (data ?? []) as ProductTemplate[]) {
        try {
          const productId = await client.resolve(template);
          const catalog = await client.product(productId);
          const files = await client.printfiles(productId, template.technique);
          let placement = template.placement;
          // A single supported placement is unambiguous; never choose among multiple alternatives silently.
          if (
            !files.available_placements[placement] &&
            Object.keys(files.available_placements).length === 1
          )
            placement = Object.keys(files.available_placements)[0];
          const available = catalog.variants.filter(
            (v) => v.in_stock !== false,
          );
          if (!available.length || catalog.product.is_discontinued)
            throw new Error("No available product variants");
          groupPrintfiles(
            files,
            available.map((v) => v.id),
            placement,
          );
          available.forEach((v) =>
            variantRetailPrice(
              v.size,
              template.retail_price_cents,
              template.size_prices,
            ),
          );
          ready.push({
            id: template.id,
            catalog_product_id: productId,
            placement,
          });
        } catch (error) {
          errors.push(
            `${template.title}: ${error instanceof Error ? error.message : "Activation failed"}`,
          );
        }
      }
      if (ready.length) {
        const { error: activateError } = await db.rpc(
          "activate_lineup_templates",
          { p_templates: ready },
        );
        if (activateError) throw activateError;
      }
      after(() =>
        runLineupWorker().catch((error) =>
          console.error("Lineup worker:", error.message),
        ),
      );
      return Response.json({ activated: ready.length, errors });
    }
    if (body.action === "disable") {
      const { error } = await db
        .from("product_templates")
        .update({ active: false })
        .eq("id", body.id);
      if (error) throw error;
      return Response.json({ success: true });
    }
    const title = String(body.title ?? "").trim();
    const category = String(body.category ?? "").trim();
    const price = Number(body.retail_price_cents);
    const scale = Number(body.scale);
    const productId = Number(body.catalog_product_id);
    const sizePrices = body.size_prices ?? {};
    const groups = body.option_groups ?? [];
    if (
      !title ||
      title.length > 160 ||
      !category ||
      category.length > 80 ||
      !Number.isInteger(price) ||
      price <= 0 ||
      price > 1000000 ||
      !Number.isFinite(scale) ||
      scale <= 0 ||
      scale > 1 ||
      !Number.isInteger(productId) ||
      productId <= 0
    )
      throw new Error(
        "Enter a product, title, category, valid retail price, and logo scale",
      );
    if (
      typeof sizePrices !== "object" ||
      Array.isArray(sizePrices) ||
      Object.values(sizePrices).some(
        (v) => !Number.isInteger(v) || Number(v) <= 0 || Number(v) > 1000000,
      )
    )
      throw new Error("Invalid size prices");
    if (!Array.isArray(groups) || groups.some((v) => typeof v !== "string"))
      throw new Error("Invalid mockup styles");
    const technique = String(body.technique ?? "dtg");
    const placement = String(body.placement ?? "front");
    const [catalog, files] = await Promise.all([
      client.product(productId),
      client.printfiles(productId, technique),
    ]);
    const available = catalog.variants.filter((v) => v.in_stock !== false);
    if (catalog.product.is_discontinued || !available.length)
      throw new Error("No available product variants");
    groupPrintfiles(
      files,
      available.map((v) => v.id),
      placement,
    );
    available.forEach((v) => variantRetailPrice(v.size, price, sizePrices));
    if (groups.some((g) => !files.option_groups?.includes(g)))
      throw new Error("Select an available mockup style");
    const value = {
      title,
      category,
      description: String(body.description ?? "").slice(0, 5000),
      catalog_product_id: productId,
      catalog_match: catalog.product.model || catalog.product.title,
      retail_price_cents: price,
      size_prices: sizePrices,
      placement,
      technique,
      scale,
      option_groups: groups,
      active: body.active === true,
    };
    const result = body.id
      ? await db.from("product_templates").update(value).eq("id", body.id)
      : await db
          .from("product_templates")
          .insert({
            ...value,
            slug: `product-${productId}-${crypto.randomUUID().slice(0, 8)}`,
          });
    if (result.error) throw result.error;
    after(() =>
      runLineupWorker().catch((error) =>
        console.error("Lineup worker:", error.message),
      ),
    );
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not save template",
      },
      { status: 400 },
    );
  }
}
