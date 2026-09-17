import { test } from "node:test";
import assert from "node:assert/strict";
import { colorBatches } from "../lib/lineup/preview-first";
import type { CatalogVariant } from "../lib/lineup/types";

test("first color includes its sizes; same-color images only share identical print areas", () => {
  const variants = Array.from(
    { length: 24 },
    (_, i) =>
      ({
        id: i + 1,
        color: i < 12 ? "Black" : "Red",
        size: String(i % 12),
        in_stock: true,
      }) as CatalogVariant,
  );
  const batches = [
    {
      printfile: { printfile_id: 1, width: 100, height: 200, dpi: 150 },
      variantIds: variants.slice(0, 20).map((v) => v.id),
    },
    {
      printfile: { printfile_id: 2, width: 200, height: 200, dpi: 150 },
      variantIds: variants.slice(20).map((v) => v.id),
    },
  ];
  const result = colorBatches(batches, variants);
  assert.equal(result.length, 3);
  assert.deepEqual(
    result[0].variantIds,
    variants.slice(0, 12).map((v) => v.id),
  );
  assert.equal(result[0].representatives?.length, 1);
  assert.equal(
    result.reduce((n, b) => n + (b.representatives?.length ?? 0), 0),
    3,
  );
  assert.deepEqual(
    result.flatMap((b) => b.variantIds).sort((a, b) => a - b),
    variants.map((v) => v.id),
  );
});
