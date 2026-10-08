/** Inspect a stored enhanced logo; --apply re-evaluates only unpublished quality holds. */
import { createAdminClient } from "../lib/supabase/admin";
import { compareLogoArtwork } from "../lib/lineup/visual-comparison";
import { readLogo } from "../lib/lineup/prepared-logo";
import {
  type LogoQuality,
} from "../lib/lineup/print-quality";
import { planArtwork } from "../lib/lineup/artwork-plan";
import type { GenerationJob } from "../lib/lineup/types";
async function main() {
  const storeId = process.argv[2],
    apply = process.argv.includes("--apply");
  if (!/^[\da-f-]{36}$/i.test(storeId ?? "")) throw Error("Provide store UUID");
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("lineup_logo_path")
    .eq("id", storeId)
    .single();
  if (error) throw error;
  const path = store.lineup_logo_path as string;
  const match = path.match(/quality-(?:v\d+-)?([0-9a-f-]{36})-enhanced\.png$/i);
  if (!match) throw Error("Store has no supported enhanced logo");
  const { data: prep, error: pe } = await db
    .from("logo_preparations")
    .select("*")
    .eq("id", match[1])
    .single();
  if (pe) throw pe;
  const clean = await readLogo(db, `${prep.user_id}/${prep.id}/clean.png`);
  const { data: output, error: oe } = await db.storage
    .from("lineup-assets")
    .download(path);
  if (oe || !output) throw Error("Enhanced artwork unavailable");
  const comparison = await compareLogoArtwork(
    clean,
    Buffer.from(await output.arrayBuffer()),
  );
  console.log(JSON.stringify(comparison, null, 2));
  const { data: jobs, error: je } = await db
    .from("product_generation_jobs")
    .select("*")
    .eq("store_id", storeId)
    .eq("logo_path", path)
    .eq("status", "failed");
  if (je) throw je;
  for (const row of jobs ?? []) {
    if (
      !row.state?.printQuality ||
      row.state.printQuality.reviewedAt ||
      row.state.publishedVariantCount
    )
      continue;
    const job = row as GenerationJob,
      template = job.template_snapshot;
    const metadata: LogoQuality = {
      ...prep.enhanced_metadata,
      reviewed: false,
      visualComparison: comparison,
    };
    const planned = planArtwork(metadata, job.state.batches?.map(b => b.printfile) ?? [], template);
    const quality = planned.quality;
    console.log(JSON.stringify({product:template.title,plan:planned.plan,status:quality.status,message:quality.message}));
    if (!apply) continue;
    const previous = job.state.artworkPlan ?? {scale:template.scale,placement:template.placement};
    const changed = previous.scale !== planned.plan.scale || previous.placement !== planned.plan.placement;
    if (changed && quality.status !== "ready") continue; // Existing proof must remain tied to its actual placement.
    if (!changed) quality.proofs = job.state.printQuality?.proofs;
    const batches = changed ? job.state.batches?.map(b => ({variantIds:b.variantIds,printfile:b.printfile})) : job.state.batches;
    const ready = quality.status === "ready";
    const { error: ue } = await db
      .from("product_generation_jobs")
      .update({
        state: { ...job.state, batches, artworkPlan: planned.plan, printQuality: quality },
        status: ready ? "pending" : "failed",
        last_error: ready ? null : quality.message,
        attempts: 0,
        available_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .eq("status", "failed")
      .eq("updated_at", row.updated_at)
      .eq("logo_path", path)
      .select("id")
      .single();
    if (ue) throw ue;
    console.log(
      JSON.stringify({
        product: template.title,
        status: quality.status,
        queued: ready,
      }),
    );
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
