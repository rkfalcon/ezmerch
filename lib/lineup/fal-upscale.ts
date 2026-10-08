import sharp from "sharp";
export function falQueueUrl(value: string) {
  const u = new URL(value);
  if (
    u.origin !== "https://queue.fal.run" ||
    !u.pathname.startsWith("/fal-ai/esrgan/requests/") ||
    u.username ||
    u.password
  )
    throw new Error("Unexpected enhancement response.");
  return u.href;
}
async function falFetch(url: string, body?: unknown, send = fetch) {
  if (!process.env.FAL_KEY)
    throw new Error(
      "AI enhancement is not configured yet. You can use a higher-resolution original.",
    );
  const response = await send(url, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok)
    throw new Error(
      `Enhancement service is unavailable (${response.status}). Your original is safe.`,
    );
  return response.json();
}
export async function submitEnhancement(
  imageUrl: string,
  scale: number,
  send = fetch,
) {
  const r = await falFetch(
    "https://queue.fal.run/fal-ai/esrgan",
    {
      image_url: imageUrl,
      scale,
      model: scale <= 2 ? "RealESRGAN_x2plus" : "RealESRGAN_x4plus",
      face: false,
      output_format: "png",
    },
    send,
  );
  return {
    request_id: String(r.request_id),
    status_url: falQueueUrl(r.status_url),
    response_url: falQueueUrl(r.response_url),
  };
}
export async function enhancementResult(
  job: { status_url: string; response_url: string },
  send = fetch,
): Promise<Buffer | null> {
  const status = await falFetch(falQueueUrl(job.status_url), undefined, send);
  if (status.error)
    throw new Error(
      "Enhancement failed. Please use the original or upload a better logo.",
    );
  if (status.status !== "COMPLETED") return null;
  const result = await falFetch(falQueueUrl(job.response_url), undefined, send);
  const u = new URL(result.image?.url);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    !(u.hostname === "fal.media" || u.hostname.endsWith(".fal.media"))
  )
    throw new Error("Unexpected enhancement image host.");
  const response = await send(u.href, {
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Could not download the enhanced logo.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing enhanced image.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    size += r.value.length;
    if (size > 40 * 1024 * 1024) {
      await reader.cancel();
      throw new Error("Enhanced image exceeds the size limit.");
    }
    chunks.push(r.value);
  }
  return Buffer.concat(chunks);
}
/** Restore the original alpha mask; the model never decides which logo pixels disappear. */
export async function restoreLogoAlpha(
  original: Buffer,
  enhanced: Buffer,
  scale: number,
) {
  const meta = await sharp(original).metadata();
  const width = Math.round(meta.width! * scale),
    height = Math.round(meta.height! * scale);
  const out = await sharp(enhanced, {
    limitInputPixels: 40_000_000,
  }).metadata();
  if (out.width !== width || out.height !== height)
    throw new Error("The enhanced image has unexpected dimensions.");
  const rgb = await sharp(enhanced)
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer();
  const alpha = await sharp(original)
    .ensureAlpha()
    .extractChannel("alpha")
    .resize(width, height, { kernel: "cubic" })
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < alpha.length; i++) {
    alpha[i] = alpha[i] <= 2 ? 0 : alpha[i] >= 253 ? 255 : alpha[i];
    const a = alpha[i] / 255;
    for (let c = 0; c < 3; c++)
      rgba[i * 4 + c] =
        a > 0
          ? Math.max(
              0,
              Math.min(255, Math.round((rgb[i * 3 + c] - 255 * (1 - a)) / a)),
            )
          : 0;
    rgba[i * 4 + 3] = alpha[i];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .withIccProfile("srgb")
    .png()
    .toBuffer();
}
