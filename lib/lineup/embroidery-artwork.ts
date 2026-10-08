import {defaultQualityPolicy,type QualityPolicy} from "./quality-policy";
import {analyzeTransparency} from "./logo-transparency";
import sharp from "sharp";
import { createAdminClient } from "../supabase/admin";
import { imageHash } from "./visual-comparison";
import { prepareLogo } from "./logo-preparation";
import {
  submitEmbroidery,
  pollEmbroidery,
  inspectEmbroidery,
} from "./embroidery-provider";
import type { LogoQuality } from "./print-quality";

type DB = ReturnType<typeof createAdminClient>;
type Cache = {
  startedAt: string;
  status: "reserved" | "queued" | "candidate" | "ready" | "failed";
  queue?: { status_url: string; response_url: string };
  metadata?: LogoQuality;
  reason?: string;
};
export type EmbroideryResult =
  | { status: "waiting" }
  | { status: "failed"; reason: string }
  | { status: "ready"; path: string; metadata: LogoQuality };
/** One bounded generation attempt per source and policy, shared across embroidery products.
 * Atomic reservation prevents duplicate paid submissions; ambiguous failures never resubmit.
 */
export async function prepareEmbroidery(
  db: DB,
  storeId: string,
  original: Buffer,
  policy: QualityPolicy = defaultQualityPolicy,
): Promise<EmbroideryResult> {
  const stem = `${storeId}/embroidery/v3-${policy.revision}-${imageHash(original)}`;
  const cachePath = `${stem}.json`,
    candidatePath = `${stem}.png`;
  const privateBucket = db.storage.from("embroidery-preparations");
  const load = await privateBucket.download(cachePath);
  let cache: Cache;
  const save = async () => {
    const { error } = await privateBucket.upload(
      cachePath,
      Buffer.from(JSON.stringify(cache)),
      { contentType: "application/json", upsert: true },
    );
    if (error) throw error;
  };
  if (!load.data) {
    if (
      load.error &&
      !["404", "400"].includes(
        String((load.error as { statusCode?: string }).statusCode),
      ) &&
      !/not found/i.test(load.error.message)
    )
      throw load.error;
    cache = { status: "reserved", startedAt: new Date().toISOString() };
    const reserved = await privateBucket.upload(
      cachePath,
      Buffer.from(JSON.stringify(cache)),
      { contentType: "application/json", upsert: false },
    );
    if (reserved.error) {
      if (/exist|duplicate/i.test(reserved.error.message))
        return { status: "waiting" };
      throw reserved.error;
    }
    try {
      cache.queue = await submitEmbroidery(original);
      cache.status = "queued";
      await save();
      return { status: "waiting" };
    } catch {
      cache.status = "failed";
      cache.reason =
        "Automatic embroidery preparation could not be completed. VeryMerch will handle this artwork.";
      await save();
      return { status: "failed", reason: cache.reason };
    }
  }
  cache = JSON.parse(await load.data.text()) as Cache;
  if (cache.status === "ready" && cache.metadata)
    return { status: "ready", path: candidatePath, metadata: cache.metadata };
  if (cache.status === "failed")
    return {
      status: "failed",
      reason: cache.reason ?? "Embroidery preparation needs attention.",
    };
  if (
    !Number.isFinite(Date.parse(cache.startedAt)) ||
    Date.now() - Date.parse(cache.startedAt) > 15 * 60_000
  ) {
    cache.status = "failed";
    cache.reason =
      "Embroidery preparation timed out. VeryMerch will handle this artwork.";
    await save();
    return { status: "failed", reason: cache.reason };
  }
  if (cache.status === "reserved") return { status: "waiting" };
  try {
    if (cache.status === "queued" && cache.queue) {
      const generated = await pollEmbroidery(cache.queue);
      if (!generated) return { status: "waiting" };
      const prepared = await prepareLogo(generated, true);
      const { error } = await privateBucket.upload(
        candidatePath,
        prepared.bytes,
        { contentType: "image/png", upsert: true },
      );
      if (error) throw error;
      cache.status = "candidate";
      await save();
      return { status: "waiting" };
    }
    if (cache.status !== "candidate") throw Error("Invalid preparation stage");
    const file = await privateBucket.download(candidatePath);
    if (file.error || !file.data) throw Error("Missing candidate");
    const bytes = Buffer.from(await file.data.arrayBuffer());
    const visualComparison = await inspectEmbroidery(original, bytes);
    const m = await sharp(bytes).metadata();
    const rgba = await sharp(bytes).ensureAlpha().raw().toBuffer();
    cache.metadata = {
      width: m.width!,
      height: m.height!,
      sourceWidth: m.width!,
      sourceHeight: m.height!,
      enhanced: false,
      reviewed: false,
      ...analyzeTransparency(rgba,m.width!,m.height!,policy.values),
      visualComparison,
    };
    if (visualComparison.status !== "passed") {
      cache.status = "failed";
      cache.reason = visualComparison.reasons.join(" ");
      await save();
      return { status: "failed", reason: cache.reason };
    }
    const publicSave = await db.storage
      .from("lineup-assets")
      .upload(candidatePath, bytes, {
        contentType: "image/png",
        upsert: false,
      });
    if (publicSave.error && !/exist|duplicate/i.test(publicSave.error.message))
      throw publicSave.error;
    cache.status = "ready";
    await save();
    return { status: "ready", path: candidatePath, metadata: cache.metadata };
  } catch {
    cache.status = "failed";
    cache.reason =
      "Automatic embroidery preparation or verification failed. VeryMerch will handle this artwork.";
    await save();
    return { status: "failed", reason: cache.reason };
  }
}
