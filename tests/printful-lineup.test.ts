import { test } from "node:test";
import assert from "node:assert/strict";

test("print area is chosen by selected variant and placement rather than first printfile", async () => {
  const { groupPrintfiles } = await import("../lib/lineup/printful");
  const groups = groupPrintfiles(
    {
      available_placements: { front: "Front" },
      printfiles: [
        { printfile_id: 1, width: 100, height: 100, dpi: 150 },
        { printfile_id: 2, width: 1800, height: 2400, dpi: 150 },
      ],
      variant_printfiles: [{ variant_id: 22, placements: { front: 2 } }],
    },
    [22],
    "front",
  );
  assert.equal(groups[0].printfile.width, 1800);
  assert.deepEqual(groups[0].variantIds, [22]);
  assert.throws(() =>
    groupPrintfiles(
      { available_placements: {}, printfiles: [], variant_printfiles: [] },
      [22],
      "front",
    ),
  );
});

test("recovering an external product does not create a duplicate", async () => {
  const { PrintfulClient } = await import("../lib/lineup/printful");
  const client = new PrintfulClient(async (_url, init) => {
    if (init?.method === "POST")
      throw new Error("Unexpected duplicate creation");
    return Response.json({
      result: { sync_product: { id: 123 }, sync_variants: [] },
    });
  });
  assert.equal(
    (
      await client.ensureSyncProduct("stable-job", {
        sync_product: { name: "Test" },
        sync_variants: [],
      })
    ).sync_product.id,
    123,
  );
});

test("Printful authentication errors are not interpreted as missing products", async () => {
  const { PrintfulClient } = await import("../lib/lineup/printful");
  const client = new PrintfulClient(
    async () => new Response("Unauthorized", { status: 401 }),
  );
  await assert.rejects(
    () =>
      client.ensureSyncProduct("job", {
        sync_product: { name: "Test" },
        sync_variants: [],
      }),
    /401/,
  );
});
