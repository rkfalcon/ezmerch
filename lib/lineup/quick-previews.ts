import {loadQualityPolicy} from "./quality-policy-store";
import { previewMetadata } from "./preview-cache";
import { planArtwork } from "./artwork-plan";
import type { LogoQuality } from "./print-quality";
import { createAdminClient } from "../supabase/admin";
import { instantPreview } from "./instant-preview";
import { PrintfulClient, PrintfulError, groupPrintfiles } from "./printful";
import type { ProductTemplate } from "./types";
/** Visual previews only: never publishes products, approves quality, or submits supplier orders. */
export async function createQuickPreviews(storeId: string, logoPath: string) {
  const db = createAdminClient();
  if (!logoPath.startsWith(`${storeId}/`)) throw new Error("Invalid logo path");
  const { data: jobs, error } = await db
    .from("product_generation_jobs")
    .select("id,generation_id,template_snapshot,state")
    .eq("store_id", storeId)
    .eq("logo_path", logoPath)
    .is("quick_preview_url", null)
    .neq("status", "completed");
  if (error) throw error;
  if (!jobs?.length) return;
  const { data: logo, error: logoError } = await db.storage
    .from("lineup-assets")
    .download(logoPath);
  if (logoError || !logo) throw new Error("Logo unavailable");
  const bytes = Buffer.from(await logo.arrayBuffer());
  const { data: sidecar } = await db.storage.from("lineup-assets").download(`${logoPath}.json`);
  const metadata: LogoQuality | null = sidecar ? JSON.parse(await sidecar.text()) : null;
  const policy = await loadQualityPolicy(db);
  const client = new PrintfulClient();
  let cursor = 0,
    stopped = false;
  const deadline = Date.now() + 120000;
  async function next() {
    while (cursor < jobs!.length && Date.now() < deadline && !stopped) {
      const job = jobs![cursor++],
        template = job.template_snapshot as ProductTemplate;
      try {
        const productId = await client.resolve(template);
        const catalog = await previewMetadata(db, `catalog:${productId}`, () => client.product(productId));
        if (catalog.product.is_discontinued) continue;
        const variant = catalog.variants.find(
          (v) =>
            v.in_stock !== false &&
            (!template.enabled_colors ||
              template.enabled_colors.includes(v.color)),
        );
        if (!variant) continue;
        const files = metadata ? await previewMetadata(db, `printfiles:${productId}:${template.technique}`, () => client.printfiles(productId, template.technique)) : null;
        const plan = job.state?.artworkPlan ?? (metadata && files
          ? planArtwork(metadata, groupPrintfiles(files, catalog.variants.filter(v => v.in_stock !== false && (!template.enabled_colors || template.enabled_colors.includes(v.color))).map(v => v.id), template.placement).map(b => b.printfile), template, policy).plan
          : { scale: Number(template.scale), placement: template.placement });
        const url = await instantPreview(
          db,
          client,
          productId,
          variant.id,
          { ...template, ...plan },
          bytes,
          storeId,
          job.generation_id ?? job.id,
          true,
        );
        if (!url) continue;
        // A replacement can happen while compositing. Never attach old artwork to the new generation.
        const { error: saveError } = await db
          .from("product_generation_jobs")
          .update({ quick_preview_url: url, quick_preview_plan: plan })
          .eq("id", job.id)
          .eq("logo_path", logoPath)
          .eq("generation_id", job.generation_id);
        if (saveError) throw saveError;
        console.info("lineup.preview_ready", { jobId: job.id, generation: job.generation_id, elapsedMs: Date.now() - (deadline - 120000) });
      } catch (e) {
        if (e instanceof PrintfulError && e.status === 429) stopped = true;
        console.warn(
          "Quick product preview:",
          e instanceof Error ? e.message : "Unavailable",
        );
      }
    }
  }
  await Promise.all([next(), next()]);
}
