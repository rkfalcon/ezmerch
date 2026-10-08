import test from "node:test";
import assert from "node:assert/strict";
import {
  enhancementScale,
  needsAutomaticEnhancement,
} from "../lib/lineup/enhancement-policy";
test("small uploads automatically enhance while large masters avoid unnecessary provider work", () => {
  assert.equal(needsAutomaticEnhancement(500, 500), true);
  assert.equal(enhancementScale(500, 500), 4);
  assert.equal(needsAutomaticEnhancement(2400, 2400), true);
  assert.equal(enhancementScale(2400, 2400), 2);
  assert.equal(enhancementScale(2800, 2800), 1); // A 2x result would exceed the 25 MP memory limit.
  assert.equal(needsAutomaticEnhancement(4000, 4000), false);
  assert.equal(needsAutomaticEnhancement(0, 0), false);
  assert.equal(enhancementScale(6000, 4000), 1);
});
