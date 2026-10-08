import test from "node:test";
import assert from "node:assert/strict";
import { planArtwork, effectiveTemplate } from "../lib/lineup/artwork-plan";
import type { ProductTemplate, GenerationJob } from "../lib/lineup/types";
const area = { printfile_id: 1, width: 1800, height: 2400, dpi: 150 };
const template = {
  scale: 0.8,
  placement: "front",
  technique: "dtg",
} as ProductTemplate;
const logo = {
  width: 2160,
  height: 2160,
  sourceWidth: 540,
  sourceHeight: 540,
  enhanced: true,
  reviewed: false,
};
test("small enhanced logo gets a bounded smaller design with admin review", () => {
  const result = planArtwork(logo, [area], template);
  assert.equal(result.quality.status, "review");
  assert.ok(
    result.plan.scale < template.scale ||
      result.plan.placement !== template.placement,
  );
  assert.ok(
    result.quality.areas.every(
      (a) => a.sourceDpi >= 75 && a.outputDpi >= a.requiredDpi,
    ),
  );
  assert.match(result.quality.message, /original image has less detail/);
});
test("adequate original artwork is ready automatically; AI changes still require internal review", () => {
  assert.equal(
    planArtwork(
      { ...logo, sourceWidth: 2160, sourceHeight: 2160, enhanced: false },
      [area],
      template,
    ).quality.status,
    "ready",
  );
  assert.equal(
    planArtwork(
      { ...logo, sourceWidth: 1200, sourceHeight: 1200 },
      [area],
      template,
    ).quality.status,
    "review",
  );
});
test("tiny originals and missing dimensions stay blocked; additional placements get bounded sizing", () => {
  assert.equal(
    planArtwork(
      { ...logo, sourceWidth: 80, sourceHeight: 80 },
      [area],
      template,
    ).quality.status,
    "blocked",
  );
  assert.equal(planArtwork(logo, [], template).quality.status, "blocked");
  const embroidery = planArtwork(logo, [area], {
    ...template,
    technique: "embroidery",
  });
  assert.ok(embroidery.plan.scale < 0.8);
  assert.equal(embroidery.quality.status, "review");
  assert.equal(
    planArtwork(logo, [area], { ...template, placement: "back" }).quality
      .status,
    "review",
  );
});
test("persisted artwork plan overrides snapshot for subsequent mockups and supplier files without mutating template", () => {
  const job = {
    template_snapshot: template,
    state: { artworkPlan: { placement: "front_left_chest", scale: 0.7 } },
  } as GenerationJob;
  assert.equal(effectiveTemplate(job).placement, "front_left_chest");
  assert.equal(effectiveTemplate(job).scale, 0.7);
  assert.equal(template.placement, "front");
});

test("size reduction alone auto-approves sufficiently detailed original artwork", () => {
  const result = planArtwork(
    {
      ...logo,
      width: 1200,
      height: 1200,
      sourceWidth: 1200,
      sourceHeight: 1200,
      enhanced: false,
    },
    [area],
    template,
  );
  assert.equal(result.plan.scale, 0.66);
  assert.equal(result.quality.status, "ready");
});
test("legacy approval still requires enough original detail at the selected size", () => {
  const result = planArtwork({ ...logo, reviewed: true }, [area], { ...template, allow_front_fallback: true });
  assert.equal(result.quality.status, "ready");
  assert.ok(result.quality.areas.every((a) => a.sourceDpi >= a.requiredDpi));
});
test("size adjustment preserves transparency review", () => {
  assert.equal(
    planArtwork(
      {
        ...logo,
        width: 1200,
        height: 1200,
        sourceWidth: 1200,
        sourceHeight: 1200,
        enhanced: false,
        semiTransparent: true,
      },
      [area],
      template,
    ).quality.status,
    "review",
  );
});
