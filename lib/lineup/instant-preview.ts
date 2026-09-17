import sharp from "sharp";
import { createHash } from "node:crypto";
import type { createAdminClient } from "../supabase/admin";
import type { PrintfulClient } from "./printful";
import { renderArtwork } from "./artwork";
import { printfulPlacement } from "./placement";
import type { ProductTemplate } from "./types";

type Layout = {
  template_id: number;
  image_url: string;
  background_url?: string | null;
  background_color?: string | null;
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;
  is_template_on_front: boolean;
};
type Templates = {
  variant_mapping: {
    variant_id: number;
    templates: { placement: string; template_id: number }[];
  }[];
  templates: Layout[];
};

async function asset(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.endsWith(".printful.com") ||
    parsed.username ||
    parsed.password ||
    parsed.port
  )
    throw new Error("Invalid preview host");
  const response = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(8000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.startsWith("image/")
  )
    throw new Error("Preview image unavailable");
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 20 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Preview image too large");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

export async function composePreview(
  logo: Buffer,
  layout: Layout,
  image: Buffer,
  background: Buffer | null,
  scale: number,
  placement: string,
) {
  const ratio = Math.min(1, 900 / layout.template_width);
  const w = Math.round(layout.template_width * ratio),
    h = Math.round(layout.template_height * ratio);
  const pw = Math.round(layout.print_area_width * ratio),
    ph = Math.round(layout.print_area_height * ratio);
  const left = Math.round(layout.print_area_left * ratio),
    top = Math.round(layout.print_area_top * ratio);
  if (
    ![w, h, pw, ph, left, top].every(Number.isFinite) ||
    w < 1 ||
    h < 1 ||
    w * h > 4_000_000 ||
    left < 0 ||
    top < 0 ||
    pw < 1 ||
    ph < 1 ||
    left + pw > w ||
    top + ph > h
  )
    throw new Error("Unsupported preview dimensions");
  const base = sharp({
    create: {
      width: w,
      height: h,
      channels: 4,
      background: layout.background_color || "#ffffff",
    },
  });
  const overlays: sharp.OverlayOptions[] = [];
  if (background)
    overlays.push({
      input: await sharp(background, { limitInputPixels: 40_000_000 })
        .resize(w, h)
        .toBuffer(),
      left: 0,
      top: 0,
    });
  const garment = {
    input: await sharp(image, { limitInputPixels: 40_000_000 })
      .resize(w, h)
      .toBuffer(),
    left: 0,
    top: 0,
  };
  const art = {
    input: await renderArtwork(logo, pw, ph, scale, placement),
    left,
    top,
  };
  overlays.push(
    ...(layout.is_template_on_front ? [art, garment] : [garment, art]),
  );
  return base
    .composite(overlays)
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88 })
    .toBuffer();
}

// These are quick placement previews, never print files or fulfillment approval.
export async function instantPreview(
  db: ReturnType<typeof createAdminClient>,
  client: PrintfulClient,
  productId: number,
  variantId: number,
  template: ProductTemplate,
  logo: Buffer,
  storeId: string,
  generation: string,
): Promise<string | null> {
  // Flat printed fronts only. Curved surfaces and embroidery need Printful's renderer.
  if (
    template.technique === "embroidery" ||
    !["front", "front_left_chest"].includes(template.placement)
  )
    return null;
  const key = `${productId}:${template.technique}`;
  const { data: cached } = await db
    .from("lineup_preview_templates")
    .select("payload,updated_at")
    .eq("id", key)
    .maybeSingle();
  let data: Templates;
  if (cached && Date.now() - Date.parse(cached.updated_at) < 24 * 60 * 60_000)
    data = cached.payload as Templates;
  else {
    data = await client.request<Templates>(
      `/mockup-generator/templates/${productId}`,
    );
    const { error } = await db
      .from("lineup_preview_templates")
      .upsert({ id: key, payload: data, updated_at: new Date().toISOString() });
    if (error) throw error;
  }
  const id = data.variant_mapping
    .find((v) => v.variant_id === variantId)
    ?.templates.find(
      (t) => t.placement === printfulPlacement(template.placement),
    )?.template_id;
  const layout = data.templates.find((t) => t.template_id === id);
  if (!layout) return null;
  const [image, background] = await Promise.all([
    asset(layout.image_url),
    layout.background_url
      ? asset(layout.background_url)
      : Promise.resolve(null),
  ]);
  const bytes = await composePreview(
    logo,
    layout,
    image,
    background,
    Number(template.scale),
    template.placement,
  );
  const path = `${storeId}/${generation}/instant-${createHash("sha256").update(key).digest("hex").slice(0, 12)}.jpg`;
  const storage = db.storage.from("lineup-assets");
  const { error } = await storage.upload(path, bytes, {
    contentType: "image/jpeg",
    upsert: true,
  });
  if (error) throw error;
  return storage.getPublicUrl(path).data.publicUrl;
}
