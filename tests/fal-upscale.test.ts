import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  falQueueUrl,
  submitEnhancement,
  enhancementResult,
  restoreLogoAlpha,
} from "../lib/lineup/fal-upscale";
test("Fal calls use server authentication, disable face changes and reject unrelated asset hosts", async () => {
  const previous = process.env.FAL_KEY;
  process.env.FAL_KEY = "test-only";
  try {
    assert.throws(() =>
      falQueueUrl("https://evil.example/fal-ai/esrgan/requests/x/status"),
    );
    const request = await submitEnhancement(
      "https://example.test/logo.png",
      2,
      (async (url, init) => {
        assert.equal(url, "https://queue.fal.run/fal-ai/esrgan");
        assert.equal(
          (init?.headers as Record<string, string>).Authorization,
          "Key test-only",
        );
        assert.equal(JSON.parse(String(init?.body)).face, false);
        return Response.json({
          request_id: "x",
          status_url: "https://queue.fal.run/fal-ai/esrgan/requests/x/status",
          response_url: "https://queue.fal.run/fal-ai/esrgan/requests/x",
        });
      }) as typeof fetch,
    );
    let count = 0;
    await assert.rejects(
      enhancementResult(request, (async () => {
        count++;
        return count === 1
          ? Response.json({ status: "COMPLETED" })
          : Response.json({ image: { url: "http://localhost/private" } });
      }) as typeof fetch),
      /host/,
    );
    assert.equal(count, 2);
  } finally {
    if (previous === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = previous;
  }
});
test("enhancement preserves alpha and rejects wrong output dimensions", async () => {
  const original = await sharp({
    create: {
      width: 4,
      height: 4,
      channels: 4,
      background: { r: 20, g: 40, b: 60, alpha: 0 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 2, height: 2, channels: 4, background: "#ff0000" },
        })
          .png()
          .toBuffer(),
        left: 1,
        top: 1,
      },
    ])
    .png()
    .toBuffer();
  const enhanced = await sharp(original)
    .flatten({ background: "white" })
    .resize(8, 8)
    .png()
    .toBuffer();
  const restored = await restoreLogoAlpha(original, enhanced, 2);
  const meta = await sharp(restored).metadata();
  assert.equal(meta.width, 8);
  assert.equal(meta.hasAlpha, true);
  assert.equal(meta.space, "srgb");
  const rgba = await sharp(restored).raw().toBuffer();
  assert.equal(rgba[3], 0);
  assert.ok(rgba[(4 * 8 + 4) * 4 + 3] > 240);
  await assert.rejects(restoreLogoAlpha(original, enhanced, 4), /dimensions/);
});
