import { test } from "node:test";
import assert from "node:assert/strict";

test("retail rounding distinguishes stickers from other products", async () => {
  const { retailPrice } = await import("../lib/lineup/pricing");
  for (const [cost, sticker, expected] of [
    [2263, false, 3100],
    [1192, false, 2000],
    [234, true, 600],
    [254, true, 700],
    [274, true, 700],
    [547, true, 900],
  ] as const) {
    assert.equal(retailPrice(cost, sticker), expected);
  }
  assert.throws(() => retailPrice(-1, false));
});

test("wide logos retain proportions within the actual print area", async () => {
  const { fitArtwork } = await import("../lib/lineup/artwork");
  assert.deepEqual(fitArtwork(2000, 1000, 1800, 2400, 0.8), {
    width: 1440,
    height: 720,
    left: 180,
    top: 840,
  });
  assert.deepEqual(fitArtwork(1000, 2000, 1800, 2400, 0.8), {
    width: 960,
    height: 1920,
    left: 420,
    top: 240,
  });
  assert.throws(() => fitArtwork(0, 100, 1800, 2400, 0.8));
});
