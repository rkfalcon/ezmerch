import sharp from "sharp";

export async function prepareLogo(bytes: Buffer, removeBackground = true) {
  const input = sharp(bytes, { limitInputPixels: 40_000_000 });
  const meta = await input.metadata();
  if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
    throw new Error("Upload a PNG, JPG, or WebP logo.");
  const { data, info } = await input
    .rotate()
    .resize({
      width: 4096,
      height: 4096,
      fit: "inside",
      withoutEnlargement: true,
    })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const warnings: string[] = [];
  let backgroundRemoved = false;
  const pixels = info.width * info.height;
  const transparent = data.some(
    (value, index) => index % 4 === 3 && value < 240,
  );
  if (removeBackground && !transparent) {
    const edge: number[] = [];
    for (let x = 0; x < info.width; x++) {
      edge.push(x, (info.height - 1) * info.width + x);
    }
    for (let y = 1; y < info.height - 1; y++) {
      edge.push(y * info.width, y * info.width + info.width - 1);
    }
    const bg = [0, 1, 2].map((channel) => {
      const values = edge
        .map((i) => data[i * 4 + channel])
        .sort((a, b) => a - b);
      return values[Math.floor(values.length / 2)];
    });
    const distance = (i: number) =>
      Math.max(
        Math.abs(data[i * 4] - bg[0]),
        Math.abs(data[i * 4 + 1] - bg[1]),
        Math.abs(data[i * 4 + 2] - bg[2]),
      );
    if (edge.filter((i) => distance(i) < 24).length / edge.length >= 0.95) {
      const seen = new Uint8Array(pixels);
      const queue = new Int32Array(pixels);
      let head = 0,
        tail = 0;
      const visit = (i: number) => {
        if (!seen[i] && distance(i) <= 40) {
          seen[i] = 1;
          queue[tail++] = i;
        }
      };
      edge.forEach(visit);
      while (head < tail) {
        const i = queue[head++];
        const x = i % info.width;
        if (x > 0) visit(i - 1);
        if (x + 1 < info.width) visit(i + 1);
        if (i >= info.width) visit(i - info.width);
        if (i + info.width < pixels) visit(i + info.width);
      }
      if (tail > pixels * 0.98)
        throw new Error(
          "We could not find a clear logo in this image. Choose a different image or keep the original background.",
        );
      for (let q = 0; q < tail; q++) {
        const i = queue[q];
        data[i * 4 + 3] = Math.round(
          255 * Math.max(0, (distance(i) - 12) / 28),
        );
      }
      backgroundRemoved = tail > 0;
      warnings.push(
        "Plain background removed. Check the preview: enclosed areas and intentional white details are preserved.",
      );
    } else
      warnings.push(
        "This background is too complex for automatic cleanup. Upload a transparent PNG for a clean print, or keep this image as it is.",
      );
  }
  const png = await sharp(data, { raw: info }).png().toBuffer();
  const output = await sharp(png).trim().png().toBuffer();
  const dimensions = await sharp(output).metadata();
  if (Math.max(dimensions.width ?? 0, dimensions.height ?? 0) < 1200)
    warnings.push(
      "This logo is small and may look soft when printed large. A larger original will give a sharper result; automatic cleanup cannot restore missing detail.",
    );
  return {
    bytes: output,
    warnings,
    backgroundRemoved,
    width: dimensions.width!,
    height: dimensions.height!,
  };
}
