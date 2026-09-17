import { printfulPlacement } from "./placement";
import { createAdminClient } from "../supabase/admin";
import sharp from "sharp";
import { renderArtwork } from "./artwork";
import { groupPrintfiles, PrintfulClient, PrintfulError } from "./printful";
import { variantRetailPrice } from "./pricing";
import type {
  GenerationJob,
  GenerationState,
  MockupImage,
  StoredVariant,
} from "./types";

const bucket = "lineup-assets";
type Database = ReturnType<typeof createAdminClient>;

async function upload(
  db: Database,
  path: string,
  bytes: Buffer,
  type: string,
): Promise<string> {
  const { error } = await db.storage
    .from(bucket)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw error;
  return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export function isPrintfulAsset(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      (parsed.hostname.endsWith(".printful.com") ||
        parsed.hostname === "printful.com" ||
        parsed.hostname === "printful-upload.s3-accelerate.amazonaws.com" ||
        parsed.hostname === "printful-upload.s3.amazonaws.com")
    );
  } catch {
    return false;
  }
}

async function downloadMockup(url: string): Promise<Buffer> {
  if (!isPrintfulAsset(url))
    throw new Error("Printful returned an unrecognized image host");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error("Could not download generated mockup");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty mockup response");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Mockup image is too large");
    }
    chunks.push(value);
  }
  return sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000 })
    .rotate()
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function saveStep(
  db: Database,
  job: GenerationJob,
  state: GenerationState,
  delay = 0,
) {
  const { data, error } = await db
    .from("product_generation_jobs")
    .update({
      state,
      status: "pending",
      attempts: 0,
      last_error: null,
      available_at: new Date(Date.now() + delay).toISOString(),
      lease_token: null,
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("lease_token", job.lease_token)
    .select("id")
    .single();
  if (error || !data) throw new Error("Could not save generation progress");
}

export async function advanceJob(
  db: Database,
  client: PrintfulClient,
  job: GenerationJob,
): Promise<void> {
  const template = job.template_snapshot;
  const state = job.state;
  if (!state.variants || !state.batches || !state.productId) {
    const productId = await client.resolve(template);
    const catalog = await client.product(productId);
    if (catalog.product.is_discontinued)
      throw new Error("This Printful product has been discontinued");
    const variants = catalog.variants.filter((v) => v.in_stock !== false);
    if (!variants.length)
      throw new Error("No available variants for this product");
    variants.forEach((v) =>
      variantRetailPrice(
        v.size,
        template.retail_price_cents,
        template.size_prices,
      ),
    );
    const files = await client.printfiles(productId, template.technique);
    const batches = groupPrintfiles(
      files,
      variants.map((v) => v.id),
      template.placement,
    );
    for (const option of template.option_groups)
      if (!files.option_groups?.includes(option))
        throw new Error(`Mockup style ${option} is no longer available`);
    await saveStep(db, job, { productId, variants, batches });
    return;
  }
  const batch = state.batches.find((b) => !b.images);
  if (batch) {
    if (!batch.artworkUrl) {
      if (!job.logo_path.startsWith(`${job.store_id}/`))
        throw new Error("Upload this store’s logo to begin generation");
      const { data, error } = await db.storage
        .from(bucket)
        .download(job.logo_path);
      if (error || !data)
        throw new Error("The saved store logo could not be loaded");
      const artwork = await renderArtwork(
        Buffer.from(await data.arrayBuffer()),
        batch.printfile.width,
        batch.printfile.height,
        Number(template.scale),
        template.placement,
      );
      batch.artworkUrl = await upload(
        db,
        `${job.store_id}/${job.id}/artwork-${batch.printfile.printfile_id}.png`,
        artwork,
        "image/png",
      );
      await saveStep(db, job, state);
      return;
    }
    if (!batch.taskKey) {
      const task = await client.createMockup(state.productId, batch, template);
      if (!task.task_key)
        throw new Error("Printful did not return a mockup task");
      batch.taskKey = task.task_key;
      batch.taskStartedAt = new Date().toISOString();
      await saveStep(db, job, state, 15_000);
      return;
    }
    const result = await client.poll(batch.taskKey);
    if (result.status === "failed") {
      delete batch.taskKey;
      throw new Error(result.error || "Printful mockup generation failed");
    }
    if (result.status !== "completed") {
      if (Date.now() - Date.parse(batch.taskStartedAt ?? "") > 30 * 60_000) {
        delete batch.taskKey;
        throw new Error("Printful mockup generation timed out");
      }
      await saveStep(db, job, state, 15_000);
      return;
    }
    if (!result.mockups?.length)
      throw new Error("Printful completed without any mockup images");
    const images: MockupImage[] = batch.downloadedImages ?? [];
    // Copy one image per lease so large style sets cannot outlive the worker.
    const index = images.length;
    const mockup = result.mockups[index];
    if (mockup) {
      const bytes = await downloadMockup(mockup.mockup_url);
      const url = await upload(
        db,
        `${job.store_id}/${job.id}/mockup-${state.batches.indexOf(batch)}-${index}.jpg`,
        bytes,
        "image/jpeg",
      );
      images.push({ url, variant_ids: mockup.variant_ids });
      batch.downloadedImages = images;
      if (images.length < result.mockups.length) {
        await saveStep(db, job, state);
        return;
      }
    }
    if (
      batch.variantIds.some(
        (id) => !images.some((image) => image.variant_ids.includes(id)),
      )
    )
      throw new Error("Printful did not produce an image for every variant");
    batch.images = images;
    delete batch.downloadedImages;
    await saveStep(db, job, state);
    return;
  }
  const images = state.batches.flatMap((b) => b.images ?? []);
  const syncProducts = state.syncProducts ?? [];
  const chunkIndex = syncProducts.length;
  const chunk = state.variants.slice(chunkIndex * 100, (chunkIndex + 1) * 100);
  if (chunk.length) {
    // Printful caps a sync product at 100 variants. Each chunk gets a stable ID;
    // all chunks still become one EZMerch product with catalog variant IDs intact.
    const externalId = `ezmerch-${job.id}${chunkIndex ? `-${chunkIndex + 1}` : ""}`;
    const sync = await client.ensureSyncProduct(externalId, {
      sync_product: { name: template.title, thumbnail: images[0].url },
      sync_variants: chunk.map((v) => ({
        variant_id: v.id,
        retail_price: (
          variantRetailPrice(
            v.size,
            template.retail_price_cents,
            template.size_prices,
          ) / 100
        ).toFixed(2),
        files: [
          {
            url: state.batches!.find((b) => b.variantIds.includes(v.id))!
              .artworkUrl!,
            type: printfulPlacement(template.placement),
            ...(template.technique === "embroidery"
              ? { options: [{ id: "auto_thread_color", value: true }] }
              : {}),
          },
        ],
      })),
    });
    if (
      chunk.some(
        (v) =>
          !sync.sync_variants.some(
            (s) => s.variant_id === v.id && s.id && s.synced,
          ),
      )
    )
      throw new Error(
        "Printful is still processing product files; retry shortly",
      );
    state.syncProducts = [...syncProducts, sync];
    await saveStep(db, job, state);
    return;
  }
  const syncedVariants = syncProducts.flatMap((s) => s.sync_variants);
  const variants: StoredVariant[] = state.variants.map((v) => {
    const actual = syncedVariants.find((s) => s.variant_id === v.id);
    if (!actual?.id || !actual.synced)
      throw new Error(
        "Printful is still processing product files; retry shortly",
      );
    return {
      variant_id: v.id,
      sync_variant_id: actual.id,
      name: v.name,
      size: v.size,
      color: v.color,
      retail_price: (
        variantRetailPrice(
          v.size,
          template.retail_price_cents,
          template.size_prices,
        ) / 100
      ).toFixed(2),
      image_url: images.find((image) => image.variant_ids.includes(v.id))!.url,
    };
  });
  const { error } = await db.rpc("complete_lineup_job", {
    p_job: job.id,
    p_lease: job.lease_token,
    p_sync_id: syncProducts[0].sync_product.id,
    p_variants: variants,
    p_images: images,
  });
  if (error) throw error;
}

export async function runLineupWorker(budgetMs = 40_000) {
  const db = createAdminClient();
  const client = new PrintfulClient();
  const started = Date.now();
  let processed = 0;
  while (Date.now() - started < budgetMs) {
    const { data, error } = await db.rpc("claim_lineup_job");
    if (error) throw error;
    const job = data?.[0] as GenerationJob | undefined;
    if (!job) break;
    try {
      await advanceJob(db, client, job);
    } catch (error) {
      const rateLimited =
        error instanceof PrintfulError && error.status === 429;
      const attempts = rateLimited ? job.attempts : job.attempts + 1;
      const availableAt = new Date(
        Date.now() +
          (rateLimited
            ? error.retryAfterMs
            : Math.min(30 * 60_000, 60_000 * 2 ** attempts)),
      ).toISOString();
      // While this job still owns the global lease, pause other ready jobs too.
      // A provider-wide quota is not an individual product failure.
      if (rateLimited) {
        const { error: pauseError } = await db
          .from("product_generation_jobs")
          .update({ available_at: availableAt })
          .eq("status", "pending")
          .lt("available_at", availableAt);
        if (pauseError) throw pauseError;
      }
      const message =
        error instanceof Error ? error.message : "Generation failed";
      const { error: saveError } = await db
        .from("product_generation_jobs")
        .update({
          state: job.state,
          status: !rateLimited && attempts >= 5 ? "failed" : "pending",
          attempts,
          last_error: message.slice(0, 700),
          available_at: availableAt,
          lease_token: null,
          lease_until: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id)
        .eq("lease_token", job.lease_token);
      if (saveError) throw saveError;
      if (rateLimited) break;
    }
    processed++;
  }
  return { processed };
}
