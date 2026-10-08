import {defaultQualityValues} from "../lib/lineup/quality-policy";
import { test } from "node:test";
import assert from "node:assert/strict";
import { assessPrintQuality } from "../lib/lineup/print-quality";
const area = { printfile_id: 1, width: 1800, height: 2400, dpi: 150 };
const logo = {
  sourceWidth: 1200,
  sourceHeight: 1200,
  width: 1200,
  height: 1200,
  enhanced: false,
  reviewed: true,
};
test("quality depends on actual placement size, not PNG density metadata", () => {
  assert.equal(
    assessPrintQuality(logo, [area], 1, "front", "print").status,
    "blocked",
  );
  assert.equal(
    assessPrintQuality(logo, [area], 1, "front_left_chest", "print").status,
    "ready",
  );
});
test("enhanced pixels cannot hide unusable source or missing approval", () => {
  assert.equal(
    assessPrintQuality(
      { ...logo, width: 4800, height: 4800, enhanced: true, reviewed: false },
      [area],
      1,
      "front",
      "print",
    ).status,
    "review",
  );
  assert.equal(
    assessPrintQuality(
      { ...logo, sourceWidth: 2400, sourceHeight: 2400, width: 4800, height: 4800, enhanced: true },
      [area],
      1,
      "front",
      "print",
    ).status,
    "ready",
  );
  assert.equal(
    assessPrintQuality(
      {
        ...logo,
        sourceWidth: 100,
        sourceHeight: 100,
        width: 4800,
        height: 4800,
        enhanced: true,
      },
      [area],
      1,
      "front",
      "print",
    ).status,
    "blocked",
  );
});
test("embroidery requires a separate placement review and unavailable specs fail closed", () => {
  assert.equal(
    assessPrintQuality(logo, [area], 0.2, "front", "embroidery").status,
    "review",
  );
  assert.equal(
    assessPrintQuality(logo, [{ ...area, dpi: 0 }], 1, "front", "print").status,
    "blocked",
  );
  assert.equal(
    assessPrintQuality(logo, [], 1, "front", "print").status,
    "blocked",
  );
});

test("generation gate stops unsafe artwork before any Printful call or publication", async () => {
  const { advanceJob } = await import("../lib/lineup/worker");
  const { PrintfulClient } = await import("../lib/lineup/printful");
  const job = {
    id: "j",
    store_id: "store",
    logo_path: "store/logos/quality-test.png",
    template_snapshot: { scale: 1, placement: "front", technique: "print" },
    state: {
      productId: 1,
      variants: [{ id: 1 }],
      batches: [{ variantIds: [1], printfile: area }],
      progressive: true,
    },
  } as unknown as Parameters<typeof advanceJob>[2];
  const settingsChain={select:()=>settingsChain,eq:()=>settingsChain,single:async()=>({data:{revision:1,values:defaultQualityValues},error:null})};
  const db = {
    from:()=>settingsChain,
    storage: {
      from: () => ({
        download: async () => ({
          data: new Blob([
            JSON.stringify({
              ...logo,
              sourceWidth: 100,
              sourceHeight: 100,
              width: 4000,
              height: 4000,
              enhanced: true,
            }),
          ]),
          error: null,
        }),
      }),
    },
  } as unknown as Parameters<typeof advanceJob>[0];
  let calls = 0;
  const client = new PrintfulClient((async () => {
    calls++;
    throw Error("Unexpected supplier call");
  }) as typeof fetch);
  await assert.rejects(advanceJob(db, client, job), /Better logo/);
  assert.equal(calls, 0);
  assert.equal(job.state.printQuality?.status, "blocked");
});
test('printed edge smoothing passes without bypassing other quality checks', () => {
 const smooth = {...logo, semiTransparent:true, edgeSmoothingOnly:true};
 assert.equal(assessPrintQuality(smooth,[area],.4,'front','print').status,'ready');
 assert.equal(assessPrintQuality({...smooth,edgeSmoothingOnly:false},[area],.4,'front','print').status,'review');
 assert.equal(assessPrintQuality(smooth,[area],1,'front','print').status,'blocked');
 assert.equal(assessPrintQuality(smooth,[area],.4,'front','embroidery').status,'review');
});
