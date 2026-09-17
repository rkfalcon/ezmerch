import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("preview jobs have priority; replacement revokes old leases and preserves product identity, prices, visibility and colors", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$select null::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    for (const migration of [
      "001_initial_schema.sql",
      "20260914190719_product_template_lineup.sql",
      "20260915144718_product_enabled_colors.sql",
      "20260917011458_product_default_color.sql",
      "20260917172317_preview_first_logo_regeneration.sql",
    ])
      await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
    await db.exec(`update product_templates set active=true where slug in ('t-shirt','hoodie');insert into stores(name,slug,lineup_logo_path)values('Store','test','store/old.png');
    update product_generation_jobs set state='{"batches":[{"images":[{"url":"old","variant_ids":[1]}]}]}',available_at=now()-interval '1 hour' where template_id=(select id from product_templates where slug='hoodie');`);
    const claim = (
      await db.query<{
        id: string;
        lease_token: string;
        template_snapshot: { slug: string };
      }>("select * from claim_lineup_job()")
    ).rows[0];
    assert.equal(claim.template_snapshot.slug, "t-shirt");
    await db.exec(`insert into products(store_id,template_id,title,published,enabled_colors,default_color,variants)
    select store_id,template_id,'Custom title',false,array['Black'],'Black','[{"variant_id":1,"retail_price":"99.00","sync_variant_id":111}]' from product_generation_jobs where id='${claim.id}';`);
    const product = (await db.query<{ id: string }>("select id from products"))
      .rows[0];
    await db.exec(
      `update stores set lineup_logo_path='store/new.png' where slug='test';`,
    );
    await assert.rejects(
      db.query("select complete_lineup_job($1,$2,1,$3::jsonb,$4::jsonb)", [
        claim.id,
        claim.lease_token,
        JSON.stringify([{ variant_id: 1 }]),
        JSON.stringify([{ url: "stale" }]),
      ]),
      /lease expired/,
    );
    const job = (
      await db.query<{
        id: string;
        lease_token: string;
        generation_id: string;
        state: object;
      }>("select * from claim_lineup_job()")
    ).rows[0];
    assert.ok(job.generation_id);
    assert.deepEqual(job.state, {});
    // Either template can win after reset. Select the existing product job explicitly.
    await db.exec(
      `update product_generation_jobs set status='pending',lease_token=null,lease_until=null;update product_generation_jobs set status='running',lease_token='00000000-0000-0000-0000-000000000001',lease_until=now()+interval '1 minute' where id='${claim.id}';`,
    );
    await db.query(
      "select complete_lineup_job($1,$2,222,$3::jsonb,$4::jsonb)",
      [
        claim.id,
        "00000000-0000-0000-0000-000000000001",
        JSON.stringify([
          {
            variant_id: 1,
            retail_price: "20.00",
            sync_variant_id: 222,
            image_url: "new",
          },
        ]),
        JSON.stringify([{ url: "new", variant_ids: [1] }]),
      ],
    );
    const updated = (
      await db.query<{
        id: string;
        published: boolean;
        default_color: string;
        enabled_colors: string[];
        variants: { retail_price: string; sync_variant_id: number }[];
        title: string;
      }>("select * from products")
    ).rows[0];
    assert.equal(updated.id, product.id);
    assert.equal(updated.title, "Custom title");
    assert.equal(updated.published, false);
    assert.equal(updated.default_color, "Black");
    assert.deepEqual(updated.enabled_colors, ["Black"]);
    assert.equal(updated.variants[0].retail_price, "99.00");
    assert.equal(updated.variants[0].sync_variant_id, 222);
    const revision = (
      await db.query<{ generation_id: string }>(
        `select generation_id from product_generation_jobs where id='${claim.id}'`,
      )
    ).rows[0].generation_id;
    await db.exec(
      `update stores set lineup_logo_path='store/newer.png' where slug='test';`,
    );
    assert.notEqual(
      (
        await db.query<{ generation_id: string }>(
          `select generation_id from product_generation_jobs where id='${claim.id}'`,
        )
      ).rows[0].generation_id,
      revision,
    );
    assert.equal((await db.query("select * from products")).rows.length, 1);
  } finally {
    await db.close();
  }
});
