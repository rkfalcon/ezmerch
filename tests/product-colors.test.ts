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

test("global limits intersect local choices without changing either saved selection", () => {
  const local = ["Black", "White"];
  const global = ["White"];
  assert.deepEqual(
    enabledVariants(variants, local, global).map((v) => v.variant_id),
    [3],
  );
  assert.deepEqual(enabledVariants(variants, ["Black"], global), []);
  assert.deepEqual(enabledVariants(variants, local, null), variants);
  assert.deepEqual(
    enabledVariants(variants, ["Black"], null).map((v) => v.variant_id),
    [1, 2],
  );
  assert.deepEqual(local, ["Black", "White"]);
  assert.deepEqual(global, ["White"]);
});

test("default product image follows enabled colors and restores a saved preference when re-enabled", async () => {
  const { defaultVariant, productDisplayImage, validateDefaultColor } =
    await import("../lib/product-colors");
  const variants = [
    { color: "Black", image_url: "black.jpg" },
    { color: "White", image_url: "white.jpg" },
    { color: "Red" },
  ];
  const product = {
    variants,
    default_color: "White",
    thumbnail_url: "old.jpg",
    enabled_colors: null,
    global_enabled_colors: null,
  };
  assert.equal(productDisplayImage(product), "white.jpg");
  assert.equal(defaultVariant(variants, "White")?.image_url, "white.jpg");
  assert.equal(
    productDisplayImage({ ...product, global_enabled_colors: ["Black"] }),
    "black.jpg",
  );
  assert.equal(
    productDisplayImage({ ...product, enabled_colors: ["Black"] }),
    "black.jpg",
  );
  assert.equal(productDisplayImage(product), "white.jpg");
  assert.equal(validateDefaultColor(variants, "White", ["White"]), "White");
  assert.equal(validateDefaultColor(variants, null, ["Black"]), null);
  assert.throws(
    () => validateDefaultColor(variants, "White", ["Black"]),
    /enabled color/,
  );
  assert.throws(
    () => validateDefaultColor(variants, "White", ["White"], ["Black"]),
    /enabled color/,
  );
  assert.throws(
    () => validateDefaultColor(variants, "Red", ["Red"]),
    /generated mockup/,
  );
});
