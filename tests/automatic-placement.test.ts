import test from "node:test";
import assert from "node:assert/strict";
import { assessPrintQuality } from "../lib/lineup/print-quality";
import { planArtwork } from "../lib/lineup/artwork-plan";
import type { ProductTemplate } from "../lib/lineup/types";
const area = { printfile_id: 1, width: 600, height: 600, dpi: 150 };
const visual = {
  version: 2,
  status: "passed" as const,
  sourceHash: "a",
  enhancedHash: "b",
  checkedAt: "now",
  model: "test",
  reasons: [],
  smallestTextHeightFraction: 0.1,
  embroidery: {
    flatColors: true,
    colorCount: 3,
    simpleShapes: true,
    transparentBackground: true,
    uncertain: false,
    minLineFraction: 0.03,
    minGapFraction: 0.1,
  },
};
const logo = {
  width: 2400,
  height: 2400,
  sourceWidth: 2400,
  sourceHeight: 2400,
  enhanced: false,
  reviewed: false,
  visualComparison: visual,
};
const template = {
  scale: 0.5,
  placement: "front",
  technique: "embroidery",
} as ProductTemplate;
test("original and fidelity-checked enhanced embroidery automatically pass physical checks", () => {
  for (const enhanced of [false, true])
    assert.equal(
      assessPrintQuality(
        { ...logo, enhanced },
        [area],
        0.8,
        "front",
        "embroidery",
      ).status,
      "ready",
    );
});
test("embroidery grows within the available area to keep lettering and gaps stitchable", () => {
  const result = planArtwork(logo, [area], template);
  assert.equal(result.quality.status, "ready");
  assert.ok(result.plan.scale > 0.5 && result.plan.scale <= 1);
});
test("high PPI cannot override thin lines, gradients, excess colors or missing evidence", () => {
  for (const embroidery of [
    undefined,
    { ...visual.embroidery, minLineFraction: 0.001 },
    { ...visual.embroidery, flatColors: false },
    { ...visual.embroidery, colorCount: 7 },
    { ...visual.embroidery, uncertain: true },
  ]) {
    assert.equal(
      assessPrintQuality(
        { ...logo, visualComparison: { ...visual, embroidery } },
        [area],
        1,
        "front",
        "embroidery",
      ).status,
      "review",
    );
  }
});
test("back placement and wide artwork can shrink without changing proportions or placement", () => {
  const result = planArtwork(
    {
      ...logo,
      width: 1200,
      height: 300,
      sourceWidth: 1200,
      sourceHeight: 300,
      visualComparison: undefined,
    },
    [{ ...area, width: 1800, height: 2400 }],
    { ...template, technique: "dtg", placement: "back", scale: 0.8 },
  );
  assert.equal(result.quality.status, "ready");
  assert.equal(result.plan.placement, "back");
  assert.ok(result.plan.scale < 0.8);
  const a = result.quality.areas[0];
  assert.ok(Math.abs(a.widthInches / a.heightInches - 4) < 0.02);
});
test("all variant areas must pass and unknown embroidery methods cannot auto-pass", () => {
  assert.equal(
    assessPrintQuality(
      logo,
      [area, { ...area, printfile_id: 2, width: 150, height: 150 }],
      0.8,
      "front",
      "embroidery",
    ).status,
    "review",
  );
  assert.equal(
    assessPrintQuality(logo, [area], 0.8, "front", "embroidery_3d").status,
    "review",
  );
});
