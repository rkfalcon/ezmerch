import {loadQualityPolicy} from "./quality-policy-store";
import { analyzeTransparency } from "./logo-transparency";
import {
  compareLogoArtwork,
  comparisonVersion,
  imageHash,
  type VisualComparison,
} from "./visual-comparison";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "../supabase/admin";
import { prepareLogo } from "./logo-preparation";
import type { LogoQuality } from "./print-quality";
export const privateLogos = "logo-originals";
type DB = ReturnType<typeof createAdminClient>;
export async function preparation(db: DB, id: string, userId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Prepare your logo again.");
  const { data, error } = await db
    .from("logo_preparations")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !data)
    throw new Error("This logo preview is unavailable. Upload it again.");
  return data;
}
export async function readLogo(db: DB, path: string) {
  const { data, error } = await db.storage.from(privateLogos).download(path);
  if (error || !data) throw new Error("Could not load saved artwork.");
  return Buffer.from(await data.arrayBuffer());
}
export async function writeLogo(
  db: DB,
  path: string,
  bytes: Buffer,
  type = "image/png",
) {
  const { error } = await db.storage
    .from(privateLogos)
    .upload(path, bytes, { contentType: type, upsert: true });
  if (error) throw error;
}
export async function createPreparation(
  db: DB,
  userId: string,
  file: File,
  remove: boolean,
) {
  if (!file.size || file.size > 4 * 1024 * 1024)
    throw new Error("Choose a PNG, JPG, or WebP logo under 4 MB.");
  const policy=await loadQualityPolicy(db);
  const original = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256")
    .update(original)
    .update(`quality-v3:${remove}:${policy.revision}`)
    .digest("hex");
  const { data: existing, error: lookupError } = await db
    .from("logo_preparations")
    .select("*")
    .eq("user_id", userId)
    .eq("source_hash", hash)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;
  const { bytes, warnings, width, height } = await prepareLogo(
    original,
    remove,
  );
  const { data: rgba } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const metadata: LogoQuality = {
    version: 1,
    sourceWidth: width,
    sourceHeight: height,
    width,
    height,
    enhanced: false,
    reviewed: false,
    ...analyzeTransparency(rgba, width, height, policy.values),
  };
  const id = crypto.randomUUID();
  await writeLogo(
    db,
    `${userId}/${id}/original`,
    original,
    `image/${(await sharp(original).metadata()).format}`,
  );
  await writeLogo(db, `${userId}/${id}/clean.png`, bytes);
  const { data, error } = await db
    .from("logo_preparations")
    .insert({ id, user_id: userId, source_hash: hash, metadata, warnings })
    .select()
    .single();
  if (error) {
    await db.storage
      .from(privateLogos)
      .remove([`${userId}/${id}/original`, `${userId}/${id}/clean.png`]);
    const { data: winner } = await db
      .from("logo_preparations")
      .select("*")
      .eq("user_id", userId)
      .eq("source_hash", hash)
      .maybeSingle();
    if (winner) return winner;
    throw error;
  }
  return data;
}
export async function preparationView(
  db: DB,
  row: Awaited<ReturnType<typeof preparation>>,
) {
  const base = `${row.user_id}/${row.id}`;
  const preview = async (path: string) => {
    const { data, error } = await db.storage
      .from(privateLogos)
      .createSignedUrl(path, 3600);
    if (error) throw error;
    return data.signedUrl;
  };
  return {
    id: row.id,
    status: row.status,
    metadata: row.metadata,
    enhancedMetadata: row.enhanced_metadata,
    warnings: row.warnings,
    preview: await preview(`${base}/clean.png`),
    original: await preview(`${base}/original`),
    enhanced:
      row.status === "enhanced" ? await preview(`${base}/enhanced.png`) : null,
    error: row.last_error,
    enhancementAvailable: !!process.env.FAL_KEY,
  };
}
export async function approvedLogo(db: DB, userId: string, form: FormData) {
  const policy=await loadQualityPolicy(db);
  const row = await preparation(
    db,
    String(form.get("preparationId") ?? ""),
    userId,
  );
  // Selection is server-owned. Owners never grant print-quality approval.
  const enhanced = row.status === "enhanced" && !!row.enhanced_metadata;
  const metadata: LogoQuality = {
    ...(enhanced ? row.enhanced_metadata : row.metadata),
    reviewed: false,
  };
  const bytes = await readLogo(
    db,
    `${userId}/${row.id}/${enhanced ? "enhanced" : "clean"}.png`,
  );
  {
    const original = enhanced
      ? await readLogo(db, `${userId}/${row.id}/clean.png`)
      : bytes;
    const sourcePixels=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    Object.assign(metadata,analyzeTransparency(sourcePixels.data,sourcePixels.info.width,sourcePixels.info.height,policy.values));
    const metadataColumn = enhanced ? "enhanced_metadata" : "metadata";
    const cached = row[metadataColumn]?.visualComparison as
      VisualComparison | undefined;
    const comparison =
      cached?.version === comparisonVersion &&
      cached.policyRevision === policy.revision &&
      !!cached.policy &&
      cached.sourceHash === imageHash(original) &&
      cached.enhancedHash === imageHash(bytes)
        ? cached
        : await compareLogoArtwork(original, bytes, fetch, policy);
    metadata.visualComparison = comparison;
    if (comparison !== cached) {
      const { error } = await db
        .from("logo_preparations")
        .update({
          [metadataColumn]: {
            ...row[metadataColumn],
            reviewed: false,
            visualComparison: comparison,
          },
        })
        .eq("id", row.id)
        .eq("user_id", userId)
        .eq("status", row.status);
      if (error)
        throw new Error("Could not save artwork comparison. Please try again.");
    }
  }
  return {
    bytes,
    metadata,
    warnings: row.warnings as string[],
    preparationId: row.id,
  };
}
export async function storeApprovedLogo(
  db: DB,
  storeId: string,
  logo: Awaited<ReturnType<typeof approvedLogo>>,
) {
  const path = `${storeId}/logos/quality-v4-${logo.preparationId}-${logo.metadata.enhanced ? "enhanced" : "original"}.png`;
  for (const [key, bytes, type] of [
    [path, logo.bytes, "image/png"],
    [
      `${path}.json`,
      Buffer.from(JSON.stringify(logo.metadata)),
      "application/json",
    ],
  ] as const) {
    const { error } = await db.storage
      .from("lineup-assets")
      .upload(key, bytes, { contentType: type, upsert: true });
    if (error) throw error;
  }
  return {
    path,
    logoUrl: db.storage.from("lineup-assets").getPublicUrl(path).data.publicUrl,
  };
}
