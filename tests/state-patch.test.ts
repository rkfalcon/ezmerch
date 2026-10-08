import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { generationStatePatch } from "../lib/lineup/state-patch";
import type { GenerationState } from "../lib/lineup/types";

test("progress patches omit unchanged catalogs and replace only the changed batch", () => {
  const before = {
    variants: [{ id: 1, name: "x".repeat(10000) }],
    batches: [{ taskKey: "old", variantIds: [1] }, { variantIds: [2] }],
    publishedVariantCount: 1,
  } as GenerationState;
  const after = structuredClone(before);
  delete after.batches![0].taskKey;
  after.batches![0].images = [{ url: "ready", variant_ids: [1] }];
  after.publishedVariantCount = 2;
  const change = generationStatePatch(before, after);
  assert.deepEqual(change.patch, { publishedVariantCount: 2 });
  assert.deepEqual(change.batches, { "0": after.batches![0] });
  assert.ok(JSON.stringify(change).length < 200);
  assert.deepEqual(generationStatePatch(after, structuredClone(after)), {
    patch: {},
    batches: {},
    remove: [],
  });
  assert.deepEqual(generationStatePatch({}, after).patch, after);
});

test("partial saves preserve other batches, require a live lease, and deny browser roles", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table product_generation_jobs(id uuid primary key,state jsonb,status text,attempts integer,last_error text,available_at timestamptz,lease_token uuid,lease_until timestamptz,updated_at timestamptz);
      insert into product_generation_jobs(id,state,status,lease_token,lease_until) values('00000000-0000-0000-0000-000000000001','{"variants":[{"id":1}],"batches":[{"taskKey":"old"},{"keep":true}]}','running','00000000-0000-0000-0000-000000000002',now()+interval '1 minute');`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20260917212638_patch_lineup_progress.sql",
        "utf8",
      ),
    );
    const call = `select save_lineup_step('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','{"publishedVariantCount":1}','{"0":{"images":[]}}',array[]::text[],15000)`;
    await assert.rejects(
      db.exec(call.replace('{"0":{"images":[]}}', '{"9":{"images":[]}}')),
      /Invalid batch index/,
    );
    await db.exec(
      "update product_generation_jobs set lease_until=now()-interval '1 minute'",
    );
    await assert.rejects(db.exec(call), /lease expired/);
    await db.exec(
      "update product_generation_jobs set lease_until=now()+interval '1 minute'",
    );
    await db.exec(call);
    const { rows } = await db.query<{
      state: GenerationState;
      status: string;
      lease_token: string | null;
      delayed: boolean;
    }>(
      "select state,status,lease_token,available_at>now() delayed from product_generation_jobs",
    );
    assert.deepEqual(rows[0].state, {
      variants: [{ id: 1 }],
      batches: [{ images: [] }, { keep: true }],
      publishedVariantCount: 1,
    });
    assert.equal(rows[0].status, "pending");
    assert.equal(rows[0].lease_token, null);
    assert.equal(rows[0].delayed, true);
    await assert.rejects(db.exec(call), /lease expired/);
    await db.exec("set role anon");
    await assert.rejects(db.exec(call), /permission denied/);
  } finally {
    await db.close();
  }
});
