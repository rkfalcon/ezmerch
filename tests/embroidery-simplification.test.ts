import {defaultQualityValues} from "../lib/lineup/quality-policy";
import test from "node:test";
import assert from "node:assert/strict";
import {
  embroideryQueueUrl,
  parseEmbroideryIdentity,
  pollEmbroidery,
} from "../lib/lineup/embroidery-provider";
import { prepareEmbroidery } from "../lib/lineup/embroidery-artwork";
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
  reasons: [],
  smallestTextHeightFraction: 0.2,
  primarySymbolPreserved: true,
  onlySecondaryTextRemoved: true,
  noInventedContent: true,
  embroidery: {
    flatColors: true,
    colorCount: 3,
    simpleShapes: true,
    transparentBackground: true,
    uncertain: false,
    minLineFraction: 0.05,
    minGapFraction: 0.15,
  },
};
test("simplification permits secondary omissions but never renamed brands or lost symbols", () => {
  assert.equal(parseEmbroideryIdentity(JSON.stringify(good)).passed, true);
  for (const patch of [
    { enhancedText: "Sunday Souce" },
    { primarySymbolPreserved: false },
    { onlySecondaryTextRemoved: false },
    { noInventedContent: false },
    { uncertain: true },
    { primarySymbolPreserved: undefined },
  ])
    assert.equal(
      parseEmbroideryIdentity(JSON.stringify({ ...good, ...patch })).passed,
      false,
    );
  assert.throws(() => parseEmbroideryIdentity("{}"));
});
test("queue credentials cannot be sent to an unrelated host or endpoint", () => {
  assert.ok(
    embroideryQueueUrl(
      "https://queue.fal.run/fal-ai/nano-banana/requests/abc/status",
    ),
  );
  for (const url of [
    "https://evil.test/fal-ai/nano-banana/requests/a",
    "https://queue.fal.run/fal-ai/esrgan/requests/a",
    "https://user@queue.fal.run/fal-ai/nano-banana/requests/a",
  ])
    assert.throws(() => embroideryQueueUrl(url));
});
test("provider image host is validated before downloading and pending requests yield", async () => {
  const old = process.env.FAL_KEY;
  process.env.FAL_KEY = "test";
  try {
    const job = {
      status_url: "https://queue.fal.run/fal-ai/nano-banana/requests/a/status",
      response_url: "https://queue.fal.run/fal-ai/nano-banana/requests/a",
    };
    assert.equal(
      await pollEmbroidery(job, (async () =>
        Response.json({ status: "IN_QUEUE" })) as typeof fetch),
      null,
    );
    let calls = 0;
    await assert.rejects(
      pollEmbroidery(job, (async () => {
        calls++;
        return Response.json(
          calls === 1
            ? { status: "COMPLETED" }
            : { images: [{ url: "http://127.0.0.1/secret" }] },
        );
      }) as typeof fetch),
      /host/,
    );
    assert.equal(calls, 2);
  } finally {
    if (old === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = old;
  }
});
test("cached failures and stale reservations never resubmit paid requests", async () => {
  for (const cache of [
    {
      status: "failed",
      reason: "Identity changed",
      startedAt: new Date().toISOString(),
    },
    { status: "reserved", startedAt: "2000-01-01" },
  ]) {
    const bucket = {
      download: async () => ({ data: new Blob([JSON.stringify(cache)]) }),
      upload: async () => ({ error: null }),
    };
    const db = { storage: { from: () => bucket } } as unknown as Parameters<
      typeof prepareEmbroidery
    >[0];
    assert.equal(
      (await prepareEmbroidery(db, "store", Buffer.from("logo"))).status,
      "failed",
    );
  }
});

test("worker replaces stale original proofs with checked derivative before rendering", async () => {
  const sharp = (await import("sharp")).default;
  const { advanceJob } = await import("../lib/lineup/worker");
  const { PrintfulClient } = await import("../lib/lineup/printful");
  const { imageHash } = await import("../lib/lineup/visual-comparison");
  const bytes = await sharp({
    create: { width: 600, height: 600, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const derivative = `store/embroidery/v3-1-${imageHash(bytes)}.png`;
  const area = { printfile_id: 1, width: 600, height: 600, dpi: 150 };
  const comparison = {
    version: 2,
    status: "passed",
    sourceHash: "a",
    enhancedHash: "b",
    checkedAt: "now",
    model: "test",
    reasons: [],
    smallestTextHeightFraction: 0.2,
    embroidery: good.embroidery,
  };
  const metadata = {
    width: 1200,
    height: 1200,
    sourceWidth: 1200,
    sourceHeight: 1200,
    enhanced: false,
    reviewed: false,
  };
  const paths: string[] = [];
  const settingsChain={select:()=>settingsChain,eq:()=>settingsChain,single:async()=>({data:{revision:1,values:defaultQualityValues},error:null})};
  const db = {
    from:()=>settingsChain,
    storage: {
      from: () => ({
        download: async (path: string) => {
          paths.push(path);
          if (path.includes("/embroidery/") && path.endsWith(".json"))
            return {
              data: new Blob([
                JSON.stringify({
                  status: "ready",
                  metadata: { ...metadata, visualComparison: comparison },
                  startedAt: new Date().toISOString(),
                }),
              ]),
            };
          if (path.endsWith(".json"))
            return { data: new Blob([JSON.stringify(metadata)]) };
          return { data: new Blob([new Uint8Array(bytes)]) };
        },
      }),
    },
    rpc: async () => ({ data: true, error: null }),
  } as unknown as Parameters<typeof advanceJob>[0];
  const job = {
    id: "j",
    store_id: "store",
    logo_path: "store/logos/quality-original.png",
    template_snapshot: {
      technique: "embroidery",
      placement: "front",
      scale: 0.8,
    },
    state: {
      productId: 1,
      variants: [{ id: 1 }],
      previewPlanned: true,
      progressive: true,
      batches: [
        { variantIds: [1], printfile: area, artworkUrl: "old-original-proof" },
      ],
    },
  } as unknown as Parameters<typeof advanceJob>[2];
  const client = new PrintfulClient((async () => {
    throw Error("No supplier calls during screening");
  }) as typeof fetch);
  await advanceJob(db, client, job);
  assert.equal(job.state.printQuality?.status, "ready");
  assert.equal(job.state.embroideryLogoPath, derivative);
  assert.equal(job.state.batches?.[0].artworkUrl, undefined);
  await advanceJob(db, client, job);
  assert.ok(
    paths.includes(derivative),
    "preview must read the same derivative selected for fulfillment",
  );
});

test("shared pipeline submits once, yields, verifies, then reuses the derived file", async () => {
  const sharp = (await import("sharp")).default;
  const original = await sharp({
    create: { width: 40, height: 40, channels: 4, background: "#ff0000" },
  })
    .png()
    .toBuffer();
  const generated = await sharp({
    create: { width: 200, height: 200, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: original, left: 80, top: 80 }])
    .png()
    .toBuffer();
  const saved = new Map<string, Blob>();
  let submits = 0,
    inspections = 0;
  const settingsChain={select:()=>settingsChain,eq:()=>settingsChain,single:async()=>({data:{revision:1,values:defaultQualityValues},error:null})};
  const db = {
    from:()=>settingsChain,
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => ({
          data: saved.get(bucket + path) ?? null,
          error: saved.has(bucket + path)
            ? null
            : { statusCode: "404", message: "not found" },
        }),
        upload: async (
          path: string,
          data: Buffer,
          options: { upsert: boolean },
        ) => {
          const key = bucket + path;
          if (saved.has(key) && !options.upsert)
            return { error: { message: "already exists" } };
          saved.set(key, new Blob([new Uint8Array(data)]));
          return { error: null };
        },
      }),
    },
  } as unknown as Parameters<typeof prepareEmbroidery>[0];
  const oldFetch = globalThis.fetch,
    oldKey = process.env.FAL_KEY;
  process.env.FAL_KEY = "test";
  globalThis.fetch = (async (url) => {
    const u = String(url);
    if (u.endsWith("/nano-banana/edit")) {
      submits++;
      return Response.json({
        request_id: "a",
        status_url:
          "https://queue.fal.run/fal-ai/nano-banana/requests/a/status",
        response_url: "https://queue.fal.run/fal-ai/nano-banana/requests/a",
      });
    }
    if (u.endsWith("/status")) return Response.json({ status: "COMPLETED" });
    if (u.endsWith("/requests/a"))
      return Response.json({
        images: [{ url: "https://fal.media/candidate.png" }],
      });
    if (u === "https://fal.media/candidate.png")
      return new Response(new Uint8Array(generated));
    if (u.endsWith("/vision")) {
      inspections++;
      return Response.json({ output: JSON.stringify(good) });
    }
    throw Error("Unexpected request");
  }) as typeof fetch;
  try {
    assert.equal(
      (await prepareEmbroidery(db, "store", original)).status,
      "waiting",
    );
    assert.equal(
      (await prepareEmbroidery(db, "store", original)).status,
      "waiting",
    );
    const result = await prepareEmbroidery(db, "store", original);
    assert.equal(result.status, "ready");
    assert.deepEqual(await prepareEmbroidery(db, "store", original), result);
    assert.equal(submits, 1);
    assert.equal(inspections, 1);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.FAL_KEY;
    else process.env.FAL_KEY = oldKey;
  }
});
