import { createAdminClient } from "../lib/supabase/admin";
import { prepareEmbroidery } from "../lib/lineup/embroidery-artwork";
import { planArtwork } from "../lib/lineup/artwork-plan";
import { writeFileSync } from "node:fs";
async function main() {
  const storeId = process.argv[2];
  if (!/^[a-f0-9-]{36}$/.test(storeId ?? "")) throw Error("Provide store UUID");
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("lineup_logo_path")
    .eq("id", storeId)
    .single();
  if (error) throw error;
  const { data: source, error: se } = await db.storage
    .from("lineup-assets")
    .download(store.lineup_logo_path);
  if (se || !source) throw Error("Source unavailable");
  const result = await prepareEmbroidery(
    db,
    storeId,
    Buffer.from(await source.arrayBuffer()),
  );
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== "ready") return;
  const { data: image } = await db.storage
    .from("lineup-assets")
    .download(result.path);
  if (image)
    writeFileSync(
      "/tmp/ez-embroidery-candidate.png",
      Buffer.from(await image.arrayBuffer()),
    );
  const { data: jobs, error: je } = await db
    .from("product_generation_jobs")
    .select("template_snapshot,state")
    .eq("store_id", storeId);
  if (je) throw je;
  for (const j of jobs ?? [])
    if (j.template_snapshot.technique === "embroidery")
      console.log(
        JSON.stringify({
          product: j.template_snapshot.title,
          ...planArtwork(
            result.metadata,
            j.state.batches?.map(
              (b: { printfile: Parameters<typeof planArtwork>[1][number] }) =>
                b.printfile,
            ) ?? [],
            j.template_snapshot,
          ),
        }),
      );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
