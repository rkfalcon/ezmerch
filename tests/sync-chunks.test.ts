import { test } from "node:test";
import assert from "node:assert/strict";
import { advanceJob } from "../lib/lineup/worker";
import { PrintfulClient, type SyncResult } from "../lib/lineup/printful";
import type { GenerationJob } from "../lib/lineup/types";

test("192 variants sync in resumable chunks and publish one complete listing", async () => {
  const remote = new Map<string, SyncResult>();
  const sizes: number[] = [];
  let interrupt = true;
  class Client extends PrintfulClient {
    async ensureSyncProduct(
      id: string,
      payload: Parameters<PrintfulClient["ensureSyncProduct"]>[1],
    ) {
      if (remote.has(id)) return remote.get(id)!;
      assert.ok(payload.sync_variants.length <= 100);
      sizes.push(payload.sync_variants.length);
      const result = {
        sync_product: { id: remote.size + 1 },
        sync_variants: payload.sync_variants.map((v) => ({
          id: 10000 + v.variant_id,
          variant_id: v.variant_id,
          synced: true,
        })),
      };
      remote.set(id, result);
      if (remote.size === 2 && interrupt) {
        interrupt = false;
        throw new Error("Connection interrupted after creation");
      }
      return result;
    }
  }
  const variants = Array.from({ length: 192 }, (_, i) => ({
    id: i + 1,
    product_id: 1,
    name: `Variant ${i}`,
    size: "M",
    color: "Black",
    color_code: "#000",
    price: "22.63",
    in_stock: true,
  }));
  const job: GenerationJob = {
    id: "job",
    generation_id: "revision",
    store_id: "store",
    template_id: "template",
    logo_path: "store/logo.png",
    publish_on_complete: true,
    status: "running",
    attempts: 0,
    lease_token: "lease",
    template_snapshot: {
      id: "template",
      slug: "hoodie",
      title: "Hoodie",
      category: "Hoodies",
      description: "",
      catalog_product_id: 1,
      catalog_match: "18500",
      retail_price_cents: 3100,
      size_prices: {},
      placement: "front",
      technique: "dtg",
      scale: 0.8,
      option_groups: [],
      active: true,
    },
    state: {
      productId: 1,
      variants,
      batches: [
        {
          variantIds: variants.map((v) => v.id),
          printfile: { printfile_id: 1, width: 100, height: 100, dpi: 150 },
          artworkUrl: "https://example.test/art.png",
          images: [
            {
              url: "https://example.test/mock.jpg",
              variant_ids: variants.map((v) => v.id),
            },
          ],
        },
      ],
    },
  };
  const publications: Record<string, unknown>[] = [];
  const builder = {
    eq: () => builder,
    select: () => builder,
    single: async () => ({ data: { id: job.id }, error: null }),
  };
  const db = {
    from: () => ({ update: () => builder }),
    rpc: async (_name: string, args: Record<string, unknown>) => {
      publications.push(args);
      return { error: null };
    },
  } as unknown as Parameters<typeof advanceJob>[0];
  const client = new Client();
  await advanceJob(db, client, job);
  assert.equal(job.state.syncProducts?.length, 1);
  await assert.rejects(() => advanceJob(db, client, job), /interrupted/);
  assert.equal(publications.length, 0);
  job.state = JSON.parse(JSON.stringify(job.state));
  await advanceJob(db, client, job);
  await advanceJob(db, client, job);
  assert.deepEqual(sizes, [100, 92]);
  assert.deepEqual(
    [...remote.keys()],
    ["ezmerch-revision", "ezmerch-revision-2"],
  );
  assert.equal(publications.length, 1);
  const published = publications[0].p_variants as { sync_variant_id: number }[];
  assert.equal(published.length, 192);
  assert.equal(new Set(published.map((v) => v.sync_variant_id)).size, 192);
});
