import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("progressive publication keeps jobs running, notifies once, inherits size prices and rejects revoked leases", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$select null::uuid$$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for (const name of [
      "001_initial_schema.sql",
      "20260914190719_product_template_lineup.sql",
      "20260917172317_preview_first_logo_regeneration.sql",
      "20260917192022_progressive_lineup_publication.sql",
    ])
      await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    await db.exec(`insert into auth.users(id) values('00000000-0000-0000-0000-000000000001');update product_templates set active=true where slug='t-shirt';
  insert into stores(name,slug,owner_id,lineup_logo_path) values('Test','test','00000000-0000-0000-0000-000000000001','store/logo.png');update product_generation_jobs set publish_on_complete=false;`);
    const job = (
      await db.query<{ id: string; lease_token: string }>(
        "select * from claim_lineup_job()",
      )
    ).rows[0];
    const publish = (variants: unknown[]) =>
      db.query("select publish_lineup_progress($1,$2,1,$3::jsonb,$4::jsonb)", [
        job.id,
        job.lease_token,
        JSON.stringify(variants),
        JSON.stringify([{ url: "mock", variant_ids: [1, 2] }]),
      ]);
    const first = {
      variant_id: 1,
      size: "M",
      color: "Black",
      retail_price: "20.00",
      sync_variant_id: 11,
      image_url: "mock",
    };
    await publish([first]);
    await publish([first]);
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from product_generation_jobs",
        )
      ).rows[0].status,
      "running",
    );
    await db.exec(
      `update products set variants='[{"variant_id":1,"size":"M","retail_price":"33.00","sync_variant_id":11}]';`,
    );
    await publish([
      first,
      { ...first, variant_id: 2, color: "Red", sync_variant_id: 12 },
    ]);
    const product = (
      await db.query<{
        published: boolean;
        variants: { retail_price: string }[];
      }>("select published,variants from products")
    ).rows[0];
    assert.equal(product.published, false);
    assert.deepEqual(
      product.variants.map((v) => v.retail_price),
      ["33.00", "33.00"],
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('authenticated','public.publish_lineup_progress(uuid,uuid,bigint,jsonb,jsonb)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
    await db.exec("update stores set lineup_logo_path='store/replaced.png'");
    await assert.rejects(publish([first]), /lease expired/);
  } finally {
    await db.close();
  }
});
