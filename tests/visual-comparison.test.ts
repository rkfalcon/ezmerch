import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  compareLogoArtwork,
  parseVisualVerdict,
  type VisualComparison,
} from "../lib/lineup/visual-comparison";
import { assessPrintQuality } from "../lib/lineup/print-quality";
const good = {
  hasText: true,
  originalText: "Sunday Sauce",
  enhancedText: "Sunday Sauce",
  originalLegible: true,
  enhancedLegible: true,
  letteringMatch: true,
  shapesMatch: true,
  colorsMatch: true,
  edgesClean: true,
  uncertain: false,
  smallestTextHeightFraction: 0.05,
  reasons: [],
};
const png = async (color: string) =>
  sharp({ create: { width: 100, height: 100, channels: 4, background: color } })
    .png()
    .toBuffer();
test("strict verdict rejects changed letters, unreadable detail and incomplete responses", () => {
  assert.equal(parseVisualVerdict(JSON.stringify(good)).passed, true);
  assert.equal(
    parseVisualVerdict(
      JSON.stringify({ ...good, enhancedText: "Sunday Sause" }),
    ).passed,
    false,
  );
  assert.equal(
    parseVisualVerdict(JSON.stringify({ ...good, uncertain: true })).passed,
    false,
  );
  assert.equal(
    parseVisualVerdict(JSON.stringify({ ...good, originalLegible: false }))
      .passed,
    false,
  );
  assert.throws(() => parseVisualVerdict('{"passed":true}'));
  assert.throws(() =>
    parseVisualVerdict(JSON.stringify({ ...good, hasText: false })),
  );
  assert.throws(() =>
    parseVisualVerdict(
      JSON.stringify({ ...good, smallestTextHeightFraction: 0 }),
    ),
  );
});
test("gross color and alpha changes stop before paid vision call", async () => {
  let calls = 0;
  const send = (async () => {
    calls++;
    throw Error("unexpected call");
  }) as typeof fetch;
  const changed = await compareLogoArtwork(
    await png("#ff0000"),
    await png("#0000ff"),
    send,
  );
  assert.equal(changed.status, "review");
  assert.equal(calls, 0);
  const erased = await compareLogoArtwork(
    await png("#ff0000"),
    await png("#ff000000"),
    send,
  );
  assert.equal(erased.status, "review");
  assert.equal(calls, 0);
});
test("matching images require semantic pass; provider failure and malformed output fail closed", async () => {
  const previous = process.env.FAL_KEY;
  process.env.FAL_KEY = "test-key";
  try {
    const source = await png("#ff0000");
    const enlarged = await sharp(source).resize(400, 400).png().toBuffer();
    const noText = {
      ...good,
      hasText: false,
      originalText: "",
      enhancedText: "",
      smallestTextHeightFraction: null,
    };
    const result = await compareLogoArtwork(source, enlarged, (async (
      _url,
      init,
    ) => {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.image_urls.length, 2);
      assert.equal(body.enable_web_search, false);
      return Response.json({ output: JSON.stringify(noText) });
    }) as typeof fetch);
    assert.equal(result.status, "passed");
    assert.notEqual(result.sourceHash, result.enhancedHash);
    assert.equal(
      (
        await compareLogoArtwork(source, enlarged, (async () =>
          Response.json({ output: "invalid" })) as typeof fetch)
      ).status,
      "review",
    );
    assert.equal(
      (
        await compareLogoArtwork(source, enlarged, (async () => {
          throw Error("timeout");
        }) as typeof fetch)
      ).status,
      "review",
    );
  } finally {
    if (previous === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = previous;
  }
});
const checked: VisualComparison = {
  version: 1,
  status: "passed",
  sourceHash: "a",
  enhancedHash: "b",
  checkedAt: new Date().toISOString(),
  model: "test",
  reasons: [],
  smallestTextHeightFraction: 0.04,
};
const logo = {
  sourceWidth: 540,
  sourceHeight: 540,
  width: 2160,
  height: 2160,
  enhanced: true,
  reviewed: false,
  visualComparison: checked,
};
const area = { printfile_id: 1, width: 1800, height: 2400, dpi: 150 };
test("visual pass enables eligible enhanced artwork but never bypasses physical safety gates", () => {
  assert.equal(
    assessPrintQuality(logo, [area], 0.4, "front", "dtg").status,
    "ready",
  );
  assert.equal(
    assessPrintQuality(
      { ...logo, sourceWidth: 100, sourceHeight: 100 },
      [area],
      0.4,
      "front",
      "dtg",
    ).status,
    "blocked",
  );
  assert.equal(
    assessPrintQuality(
      { ...logo, semiTransparent: true },
      [area],
      0.4,
      "front",
      "dtg",
    ).status,
    "review",
  );
  assert.equal(
    assessPrintQuality(logo, [area], 0.4, "front", "embroidery").status,
    "review",
  );
  assert.equal(
    assessPrintQuality(
      {
        ...logo,
        visualComparison: { ...checked, smallestTextHeightFraction: 0.001 },
      },
      [area],
      0.4,
      "front",
      "dtg",
    ).status,
    "review",
  );
  assert.equal(
    assessPrintQuality(
      {
        ...logo,
        visualComparison: {
          ...checked,
          status: "review",
          reasons: ["Changed lettering"],
        },
      },
      [area],
      0.4,
      "front",
      "dtg",
    ).status,
    "review",
  );
  assert.equal(
    assessPrintQuality(
      { ...logo, width: 200, height: 200 },
      [area],
      0.4,
      "front",
      "dtg",
    ).status,
    "blocked",
  );
});

test("embroidery measurements are optional for printing but malformed evidence cannot qualify embroidery", () => {
  const embroidery = {
    flatColors: true,
    colorCount: 3,
    simpleShapes: true,
    transparentBackground: true,
    uncertain: false,
    minLineFraction: 0.03,
    minGapFraction: null,
  };
  assert.deepEqual(
    parseVisualVerdict(JSON.stringify({ ...good, embroidery })).embroidery,
    embroidery,
  );
  for (const patch of [
    { minLineFraction: 0 },
    { minGapFraction: -1 },
    { colorCount: 2.5 },
    { uncertain: "false" },
  ]) {
    const result = parseVisualVerdict(
      JSON.stringify({ ...good, embroidery: { ...embroidery, ...patch } }),
    );
    assert.equal(result.passed, true);
    assert.equal(result.embroidery, undefined);
  }
});
