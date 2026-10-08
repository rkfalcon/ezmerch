import test from "node:test";
import assert from "node:assert/strict";
import { compactGenerationState } from "../lib/lineup/generation-state";
import type { GenerationState } from "../lib/lineup/types";

test("stored progress retains fulfillment identifiers without provider file payloads", () => {
  const sync = {
    sync_product: { id: 9, external_id: "remote" },
    sync_variants: [
      {
        id: 10,
        variant_id: 11,
        synced: true,
        files: [{ metadata: "x".repeat(20000) }],
      },
    ],
  };
  const state = {
    productId: 1,
    progressive: true,
    publishedVariantCount: 1,
    instantPreview: "preview",
    variants: [
      {
        id: 11,
        product_id: 1,
        name: "Shirt",
        size: "M",
        color: "Black",
        color_code: "#000000",
        price: "10",
        in_stock: true,
        availability_regions: { unused: "x".repeat(20000) },
      },
    ],
    batches: [
      {
        variantIds: [11],
        assetKey: "stable",
        printfile: { printfile_id: 1, width: 100, height: 100, dpi: 150 },
        artworkUrl: "art",
        taskKey: "task",
        images: [{ url: "image", variant_ids: [11] }],
        syncProducts: [sync],
      },
    ],
    syncProducts: [sync],
  } as unknown as GenerationState;
  const compact = compactGenerationState(state);
  assert.deepEqual(compact.batches![0].syncProducts, [
    {
      sync_product: { id: 9 },
      sync_variants: [{ id: 10, variant_id: 11, synced: true }],
    },
  ]);
  assert.equal(compact.variants![0].color, "Black");
  assert.equal(compact.batches![0].assetKey, "stable");
  assert.deepEqual(compact.batches![0].images, state.batches![0].images);
  assert.equal(compact.publishedVariantCount, 1);
  assert.deepEqual(compactGenerationState(compact), compact);
  assert.ok(JSON.stringify(compact).length < JSON.stringify(state).length / 10);
  assert.ok(
    JSON.stringify(state).includes("metadata"),
    "do not mutate caller state",
  );
});
