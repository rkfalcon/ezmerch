import { test } from "node:test";
import assert from "node:assert/strict";
import { enabledVariants, validateColorSelection } from "../lib/product-colors";

const variants = [
  { variant_id: 1, color: "Black", size: "S" },
  { variant_id: 2, color: "Black", size: "L" },
  { variant_id: 3, color: "White", size: "M" },
];
test("color selection preserves every size in enabled colors and blocks disabled cart variants", () => {
  assert.deepEqual(
    enabledVariants(variants, ["Black"]).map((v) => v.variant_id),
    [1, 2],
  );
  assert.equal(
    enabledVariants(variants, ["Black"]).find((v) => v.variant_id === 3),
    undefined,
  );
  assert.deepEqual(enabledVariants(variants, null), variants);
  assert.deepEqual(enabledVariants(variants, []), []);
});
test("color settings reject empty and unknown choices without altering the catalog", () => {
  assert.throws(() => validateColorSelection(variants, []), /at least one/);
  assert.throws(() => validateColorSelection(variants, ["Red"]), /available/);
  assert.deepEqual(validateColorSelection(variants, ["Black", "Black"]), [
    "Black",
  ]);
  assert.equal(variants.length, 3);
});
test("single-color and colorless products retain all size variants", () => {
  const sizes = [
    { color: null, size: "3x3" },
    { color: "", size: "4x4" },
  ];
  assert.deepEqual(validateColorSelection(sizes, ["Default"]), ["Default"]);
  assert.equal(enabledVariants(sizes, ["Default"]).length, 2);
});
