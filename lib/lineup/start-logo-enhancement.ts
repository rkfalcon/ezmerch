import sharp from "sharp";
import { createAdminClient } from "../supabase/admin";
import {
  preparation,
  readLogo,
  writeLogo,
  privateLogos,
} from "./prepared-logo";
import { submitEnhancement } from "./fal-upscale";
import { enhancementScale } from "./enhancement-policy";
export async function startLogoEnhancement(
  db: ReturnType<typeof createAdminClient>,
  row: Awaited<ReturnType<typeof preparation>>,
) {
  const id = row.id,
    userId = row.user_id;
  if (row.status !== "clean") return row;
  if (!process.env.FAL_KEY)
    throw new Error(
      "AI enhancement is unavailable. Your original is preserved.",
    );
  const meta = row.metadata;
  const factor = enhancementScale(meta.width, meta.height);
  if (factor < 2)
    throw new Error(
      "This logo is already large. Use the original and review its placement quality.",
    );
  const { data: reserved, error } = await db.rpc("reserve_logo_enhancement", {
    p_id: id,
    p_user: userId,
  });
  if (error) throw new Error(error.message);
  if (!reserved) return await preparation(db, id, userId);

  try {
    const base = `${userId}/${id}`;
    const clean = await readLogo(db, `${base}/clean.png`);
    const rgb = await sharp(clean)
      .flatten({ background: "#ffffff" })
      .withIccProfile("srgb")
      .png()
      .toBuffer();
    await writeLogo(db, `${base}/fal-input.png`, rgb);
    const { data: signed, error: signError } = await db.storage
      .from(privateLogos)
      .createSignedUrl(`${base}/fal-input.png`, 3600);
    if (signError) throw signError;
    const job = await submitEnhancement(signed.signedUrl, factor);
    const { error: saveError } = await db
      .from("logo_preparations")
      .update({ status: "queued", fal_request: { ...job, scale: factor } })
      .eq("id", id)
      .eq("user_id", userId);
    if (saveError) throw saveError;
    return await preparation(db, id, userId);
  } catch (error) {
    await db
      .from("logo_preparations")
      .update({
        status: "failed",
        last_error:
          "Enhancement could not be confirmed. Use the original or a higher-resolution upload.",
      })
      .eq("id", id)
      .eq("user_id", userId);
    throw error;
  }
}
