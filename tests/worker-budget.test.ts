import test from "node:test";
import assert from "node:assert/strict";
import { runLineupWorker } from "../lib/lineup/worker";

test("a worker invocation advances only one ready job even if more remain", async () => {
  const previous = {
    fetch: globalThis.fetch,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    pause: process.env.BACKGROUND_JOBS_PAUSED,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  process.env.BACKGROUND_JOBS_PAUSED = "false";
  let claims = 0;
  let saves = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/rpc/claim_lineup_job")) {
      claims++;
      return Response.json(
        claims > 2
          ? []
          : [
              {
                id: "job",
                store_id: "store",
                lease_token: "lease",
                attempts: 0,
                template_snapshot: {},
                state: {
                  productId: 1,
                  variants: [{ id: 2 }],
                  previewPlanned: true,
                  progressive: true,
                  instantPreview: null,
                  batches: [
                    {
                      variantIds: [],
                      printfile: { printfile_id: 1 },
                      artworkUrl: "https://example.com/art.png",
                      images: [],
                    },
                    { variantIds: [2], printfile: { printfile_id: 1 } },
                  ],
                },
              },
            ],
      );
    }
    if (init?.method === "PATCH") {
      saves++;
      return Response.json({ id: "job" });
    }
    throw new Error("Unexpected worker request");
  };
  try {
    const result = await runLineupWorker(5000);
    assert.equal(result.processed, 1);
    assert.equal(
      claims,
      1,
      "must yield instead of immediately claiming another job",
    );
    assert.equal(saves, 1);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: previous.url,
      SUPABASE_SERVICE_ROLE_KEY: previous.key,
      BACKGROUND_JOBS_PAUSED: previous.pause,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
