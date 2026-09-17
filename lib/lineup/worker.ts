import { instantPreview } from "./instant-preview";
import { colorBatches, previewFirstBatches } from "./preview-first";
import { printfulPlacement } from "./placement";
import { createAdminClient } from "../supabase/admin";
import sharp from "sharp";
import { renderArtwork } from "./artwork";
import { groupPrintfiles, PrintfulClient, PrintfulError } from "./printful";
import { variantRetailPrice } from "./pricing";
import type {
  CatalogVariant,
  MockupBatch,
  ProductTemplate,
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

function syncPayload(
  template: ProductTemplate,
  variants: CatalogVariant[],
  batches: MockupBatch[],
  thumbnail: string,
): Parameters<PrintfulClient["ensureSyncProduct"]>[1] {
  return {
    sync_product: { name: template.title, thumbnail },
    sync_variants: variants.map((v) => {
      const url = batches.find((b) => b.variantIds.includes(v.id))?.artworkUrl;
      if (!url) throw new Error("Missing print artwork for variant");
      return {
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
            url,
            type: printfulPlacement(template.placement),
            ...(template.technique === "embroidery"
              ? { options: [{ id: "auto_thread_color", value: true }] }
              : {}),
          },
        ],
      };
    }),
  };
}

// Synchronize and expose ready colors before requesting any more mockups.
async function publishReadyBatches(
  db: Database,
  client: PrintfulClient,
  job: GenerationJob,
): Promise<boolean> {
  const { state, template_snapshot: template } = job;
  const batches = state.batches!;
  const variants = state.variants!;
  const syncProducts = batches.flatMap((b) => b.syncProducts ?? []);
  const syncedVariants = syncProducts.flatMap((s) => s.sync_variants);
  const images = batches.flatMap((b) => b.images ?? []);
  const ready: StoredVariant[] = variants
    .filter((v) =>
      syncedVariants.some((s) => s.variant_id === v.id && s.synced),
    )
    .map((v) => ({
      variant_id: v.id,
      sync_variant_id: syncedVariants.find((s) => s.variant_id === v.id)!.id,
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
      image_url: images.find((i) => i.variant_ids.includes(v.id))!.url,
    }));
  const complete = ready.length === variants.length;
  if (
    ready.length &&
    (complete || ready.length !== state.publishedVariantCount)
  ) {
    const { error } = await db.rpc(
      complete ? "complete_lineup_job" : "publish_lineup_progress",
      {
        p_job: job.id,
        p_lease: job.lease_token,
        p_sync_id: syncProducts[0].sync_product.id,
        p_variants: ready,
        p_images: images,
      },
    );
    if (error) throw error;
    if (!complete) {
      state.publishedVariantCount = ready.length;
      await saveStep(db, job, state);
    }
    return true;
  }
  for (const [index, batch] of batches.entries()) {
    if (!batch.images) continue;
    const synced = batch.syncProducts ?? [];
    const chunk = batch.variantIds.slice(
      synced.length * 100,
      (synced.length + 1) * 100,
    );
    if (!chunk.length) continue;
    const externalId = `ezmerch-${job.generation_id ?? job.id}-b${index}-c${synced.length}`;
    const result = await client.ensureSyncProduct(
      externalId,
      syncPayload(
        template,
        chunk.map((id) => variants.find((v) => v.id === id)!),
        [batch],
        batch.images[0].url,
      ),
    );
    if (
      chunk.some(
        (id) =>
          !result.sync_variants.some(
            (v) => v.variant_id === id && v.id && v.synced,
          ),
      )
    )
      throw new Error(
        "Printful is still processing product files; retry shortly",
      );
    batch.syncProducts = [...synced, result];
    await saveStep(db, job, state);
    return true;
  }
  return false;
}

export async function advanceJob(
  db: Database,
  client: PrintfulClient,
  job: GenerationJob,
): Promise<void> {
  const template = job.template_snapshot;
  const state = job.state;
  const generation = job.generation_id ?? job.id;
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
    await saveStep(db, job, {
      productId,
      variants,
      batches: colorBatches(batches, variants, template.enabled_colors),
      progressive: true,
      previewPlanned: true,
    });
    return;
  }
  if (!state.previewPlanned) {
    if (
      state.batches.every((b) => !b.taskKey && !b.images && !b.downloadedImages)
    ) {
      state.batches = previewFirstBatches(
        state.batches,
        state.variants,
        template.enabled_colors,
      );
      state.previewPlanned = true;
      await saveStep(db, job, state);
      return;
    }
    state.previewPlanned = true;
  }
  // Existing jobs with legacy sync chunks finish using their original stable IDs.
  if (
    !state.progressive &&
    !state.syncProducts?.length &&
    state.batches.some((b) => !b.images)
  ) {
    const started = state.batches
      .map((b, index) => ({ ...b, assetKey: b.assetKey ?? String(index) }))
      .filter((b) => b.taskKey || b.images || b.downloadedImages);
    const unstarted = state.batches.filter(
      (b) => !b.taskKey && !b.images && !b.downloadedImages,
    );
    state.batches = [
      ...started,
      ...colorBatches(unstarted, state.variants, template.enabled_colors).map(
        (b, index) => ({ ...b, assetKey: `fast-${index}` }),
      ),
    ];
    state.progressive = true;
    await saveStep(db, job, state);
    return;
  }
  if (
    state.progressive &&
    state.instantPreview === undefined &&
    !state.batches.some((b) => b.images)
  ) {
    state.instantPreview = null;
    try {
      if (!job.logo_path.startsWith(`${job.store_id}/`))
        throw new Error("Invalid logo path");
      const { data, error } = await db.storage
        .from(bucket)
        .download(job.logo_path);
      if (error || !data) throw new Error("Logo unavailable");
      state.instantPreview = await instantPreview(
        db,
        client,
        state.productId,
        state.batches[0].variantIds[0],
        template,
        Buffer.from(await data.arrayBuffer()),
        job.store_id,
        generation,
      );
    } catch (error) {
      // An optional preview must never block the real mockup or product listing.
      console.warn(
        "Quick preview unavailable:",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
    await saveStep(db, job, state);
    return;
  }
  if (state.progressive && (await publishReadyBatches(db, client, job))) return;
  const batch = state.batches.find((b) => !b.images);
  if (batch) {
    if (!batch.artworkUrl) {
      const cached = state.batches.find(
        (b) =>
          b.printfile.printfile_id === batch.printfile.printfile_id &&
          b.artworkUrl,
      );
      if (cached) {
        batch.artworkUrl = cached.artworkUrl;
        await saveStep(db, job, state);
        return;
      }
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
        `${job.store_id}/${generation}/artwork-${batch.printfile.printfile_id}.png`,
        artwork,
        "image/png",
      );
      await saveStep(db, job, state);
      return;
    }
    if (!batch.taskKey) {
      const { data: waitMs, error: paceError } = await db.rpc(
        "reserve_lineup_mockup_slot",
      );
      if (paceError || typeof waitMs !== "number")
        throw new Error("Could not reserve a Printful request slot");
      if (waitMs > 0) {
        await saveStep(db, job, state, waitMs);
        return;
      }
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
        `${job.store_id}/${generation}/mockup-${batch.assetKey ?? state.batches.indexOf(batch)}-${index}.jpg`,
        bytes,
        "image/jpeg",
      );
      images.push({
        url,
        variant_ids: batch.representatives
          ? batch.representatives
              .filter((r) => mockup.variant_ids.includes(r.id))
              .flatMap((r) => r.variantIds)
          : mockup.variant_ids,
      });
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
    const externalId = `ezmerch-${generation}${chunkIndex ? `-${chunkIndex + 1}` : ""}`;
    const sync = await client.ensureSyncProduct(
      externalId,
      syncPayload(template, chunk, state.batches, images[0].url),
    );
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
    if (!job) {
      // Stay alive across short poll/quota waits instead of losing a full cron minute.
      const { data: next } = await db
        .from("product_generation_jobs")
        .select("available_at")
        .eq("status", "pending")
        .order("available_at")
        .limit(1)
        .maybeSingle();
      if (!next) break;
      const delay = Date.parse(next.available_at) - Date.now();
      if (delay <= 0) break; // Another worker owns the lease, or this job is paused.
      if (delay + 5000 >= budgetMs - (Date.now() - started)) break;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, 5000)),
      );
      continue;
    }
    try {
      await advanceJob(db, client, job);
    } catch (error) {
      const rateLimited =
        error instanceof PrintfulError && error.status === 429;
      const outOfStock =
        error instanceof Error &&
        error.message === "No available variants for this product";
      const attempts =
        rateLimited || outOfStock ? job.attempts : job.attempts + 1;
      const availableAt = new Date(
        Date.now() +
          (outOfStock
            ? 6 * 60 * 60_000
            : rateLimited
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
          status:
            !rateLimited && !outOfStock && attempts >= 5 ? "failed" : "pending",
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
