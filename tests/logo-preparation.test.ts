import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareLogo } from "../lib/lineup/logo-preparation";
import { previewFirstBatches } from "../lib/lineup/preview-first";
import type { CatalogVariant } from "../lib/lineup/types";

test("preview stage selects one enabled color and preserves every remaining variant exactly once", () => {
  const batches = [
    {
      variantIds: [1, 2, 3],
      printfile: { printfile_id: 1, width: 100, height: 100, dpi: 300 },
    },
    {
      variantIds: [4],
      printfile: { printfile_id: 2, width: 200, height: 100, dpi: 300 },
    },
  ];
  const variants = [
    { id: 1, color: "White" },
    { id: 2, color: "Black" },
    { id: 3, color: "Blue" },
    { id: 4, color: "Black" },
  ] as CatalogVariant[];
  const result = previewFirstBatches(batches, variants, ["Blue"]);
  assert.deepEqual(result[0].variantIds, [3]);
  assert.deepEqual(result.flatMap((b) => b.variantIds).sort(), [1, 2, 3, 4]);
  assert.deepEqual(batches[0].variantIds, [1, 2, 3]);
});
test("plain background cleanup retains interior white logo details and warns for low resolution", async () => {
  const raw = Buffer.alloc(100 * 100 * 4, 255);
  for (let y = 20; y < 80; y++)
    for (let x = 20; x < 80; x++) {
      const i = (y * 100 + x) * 4;
      raw[i] = 255;
      raw[i + 1] = 0;
      raw[i + 2] = 0;
    }
  for (let y = 40; y < 60; y++)
    for (let x = 40; x < 60; x++) {
      const i = (y * 100 + x) * 4;
      raw[i] = raw[i + 1] = raw[i + 2] = 255;
    }
  // Round off a corner so transparency remains visible after trimming.
  for (let y = 20; y < 30; y++)
    for (let x = 20; x < 30; x++) {
      const i = (y * 100 + x) * 4;
      raw[i] = raw[i + 1] = raw[i + 2] = 255;
    }
  const input = await sharp(raw, {
    raw: { width: 100, height: 100, channels: 4 },
  })
    .png()
    .toBuffer();
  const cleaned = await prepareLogo(input);
  assert.equal(cleaned.backgroundRemoved, true);
  assert.ok(cleaned.warnings.some((w) => w.includes("small")));
  const { data, info } = await sharp(cleaned.bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
  const center =
    (Math.floor(info.height / 2) * info.width + Math.floor(info.width / 2)) * 4;
  assert.equal(data[center], 255);
  assert.equal(data[center + 3], 255);
  assert.equal((await prepareLogo(input, false)).backgroundRemoved, false);
});
test("already transparent artwork is preserved and complex backgrounds are not guessed", async () => {
  const raw = Buffer.alloc(80 * 80 * 4);
  for (let y = 10; y < 70; y++)
    for (let x = 10; x < 70; x++) {
      const i = (y * 80 + x) * 4;
      raw[i] = raw[i + 1] = raw[i + 2] = raw[i + 3] = 255;
    }
  const image = await sharp(raw, {
    raw: { width: 80, height: 80, channels: 4 },
  })
    .png()
    .toBuffer();
  assert.equal((await prepareLogo(image)).backgroundRemoved, false);
  const complex = await sharp({
    create: { width: 80, height: 80, channels: 3, background: "red" },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 40, height: 80, channels: 3, background: "blue" },
        })
          .png()
          .toBuffer(),
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toBuffer();
  const result = await prepareLogo(complex);
  assert.equal(result.backgroundRemoved, false);
  assert.ok(result.warnings.some((w) => w.includes("complex")));
});
