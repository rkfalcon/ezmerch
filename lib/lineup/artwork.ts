import { leftChestPlacement } from "./placement";
import sharp from "sharp";

export function fitArtwork(
  width: number,
  height: number,
  areaWidth: number,
  areaHeight: number,
  scale: number,
  placement = "front",
) {
  if (
    [width, height, areaWidth, areaHeight, scale].some(
      (v) => !Number.isFinite(v) || v <= 0,
    ) ||
    scale > 1
  )
    throw new Error("Invalid artwork dimensions");
  const chest = placement === leftChestPlacement;
  const boxWidth = chest ? areaWidth * 0.3 : areaWidth;
  const boxHeight = chest ? areaHeight * 0.25 : areaHeight;
  const ratio = Math.min(
    (boxWidth * scale) / width,
    (boxHeight * scale) / height,
  );
  const w = Math.max(1, Math.round(width * ratio));
  const h = Math.max(1, Math.round(height * ratio));
  return {
    width: w,
    height: h,
    left: Math.round(chest ? areaWidth * 0.75 - w / 2 : (areaWidth - w) / 2),
    top: Math.round(chest ? areaHeight * 0.18 - h / 2 : (areaHeight - h) / 2),
  };
}

export async function normalizeLogo(bytes: Buffer): Promise<Buffer> {
  const input = sharp(bytes, { limitInputPixels: 40_000_000 });
  const metadata = await input.metadata();
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? ""))
    throw new Error("Upload a PNG, JPG, or WebP logo");
  return input.rotate().trim().png().toBuffer();
}

export async function renderArtwork(
  logo: Buffer,
  width: number,
  height: number,
  scale: number,
  placement = "front",
): Promise<Buffer> {
  if (width * height > 40_000_000)
    throw new Error("Print area exceeds supported image size");
  const metadata = await sharp(logo).metadata();
  const fit = fitArtwork(
    metadata.width!,
    metadata.height!,
    width,
    height,
    scale,
    placement,
  );
  const resized = await sharp(logo)
    .resize(fit.width, fit.height, { fit: "fill" })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, left: fit.left, top: fit.top }])
    .png()
    .toBuffer();
}
