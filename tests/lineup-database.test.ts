import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("logo upload snapshots initial publication, later templates create drafts, and retries do not duplicate jobs", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
    `);
    await db.exec(
      readFileSync("supabase/migrations/001_initial_schema.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20260914190719_product_template_lineup.sql",
        "utf8",
      ),
    );
    const tables = await db.query<{ exists: boolean }>(
      `select to_regclass('public.product_templates') is not null as exists`,
    );
    assert.equal(tables.rows[0].exists, true, "template schema must exist");
    await db.exec(
      readFileSync(
        "supabase/migrations/20260915144718_product_enabled_colors.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20260916204818_global_product_availability.sql",
        "utf8",
      ),
    );
    await db.exec(`insert into stores(id,name,slug) values ('00000000-0000-0000-0000-000000000001','Test','test');
      update product_templates set active=true where slug in ('hoodie','t-shirt');
      update stores set lineup_logo_path='logos/test.png' where slug='test';`);
    let jobs = await db.query<{ publish_on_complete: boolean }>(
      "select publish_on_complete from product_generation_jobs",
    );
    assert.equal(jobs.rows.length, 2);
    assert.ok(jobs.rows.every((j) => j.publish_on_complete));
    await db.exec(
      `update stores set lineup_logo_path='logos/replacement.png' where slug='test'`,
    );
    assert.equal(
      (await db.query("select * from product_generation_jobs")).rows.length,
      2,
    );
    await db.exec(`insert into products(store_id,title,published) select id,'Existing hidden product',false from stores where slug='test';
      update product_templates set active=true where slug='beanie';`);
    assert.equal(
      (
        await db.query<{ enabled_colors: string[] | null }>(
          "select enabled_colors from products",
        )
      ).rows[0].enabled_colors,
      null,
    );
    await assert.rejects(
      () => db.exec("update products set enabled_colors='{}'::text[]"),
      /products_enabled_colors_nonempty/,
    );
    jobs = await db.query(
      `select j.publish_on_complete from product_generation_jobs j join product_templates t on t.id=j.template_id where t.slug='beanie'`,
    );
    assert.deepEqual(jobs.rows, [{ publish_on_complete: false }]);
    await db.exec(
      `update product_templates set active=false where slug='beanie'; update product_templates set active=true where slug='beanie';`,
    );
    assert.equal(
      (await db.query("select * from product_generation_jobs")).rows.length,
      3,
    );
    const claimed = await db.query<{ id: string; lease_token: string }>(
      "select * from claim_lineup_job()",
    );
    assert.equal(claimed.rows.length, 1);
    assert.equal(
      (await db.query("select * from claim_lineup_job()")).rows.length,
      0,
      "one global Printful worker at a time",
    );
    await db.exec(`insert into auth.users(id) values ('00000000-0000-0000-0000-000000000010'),('00000000-0000-0000-0000-000000000011'),('00000000-0000-0000-0000-000000000012');
      insert into user_roles(user_id,role) values('00000000-0000-0000-0000-000000000010','admin');
      update stores set owner_id='00000000-0000-0000-0000-000000000011' where slug='test';
      update product_generation_jobs set status='pending',lease_until=null,lease_token=null;
      update product_generation_jobs set available_at=now()+interval '1 day' where template_id in (select id from product_templates where slug<>'beanie');`);
    const draft = (
      await db.query<{ id: string; lease_token: string }>(
        "select * from claim_lineup_job()",
      )
    ).rows[0];
    await db.query(
      `select complete_lineup_job($1,$2,123,$3::jsonb,$4::jsonb)`,
      [
        draft.id,
        draft.lease_token,
        JSON.stringify([
          { variant_id: 1, sync_variant_id: 101, retail_price: "22.00" },
        ]),
        JSON.stringify([
          { url: "https://example.com/branded.jpg", variant_ids: [1] },
        ]),
      ],
    );
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      2,
      "owner and admin each notified",
    );
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      2,
      "email outbox mirrors recipients",
    );
    await assert.rejects(
      () =>
        db.query(`select complete_lineup_job($1,$2,123,'[]','[]')`, [
          draft.id,
          draft.lease_token,
        ]),
      /lease expired/,
    );
    // A second store's hidden choice must survive global off/on changes too.
    await db.exec(`insert into stores(id,name,slug) values ('00000000-0000-0000-0000-000000000002','Second','second');
      insert into products(store_id,title,template_id,published,enabled_colors)
      select '00000000-0000-0000-0000-000000000002','Locally hidden',id,false,array['White'] from product_templates where slug='beanie';`);
    // Existing and newly generated products inherit global limits without losing local settings.
    await db.exec(`update products set published=true, enabled_colors=array['Black'] where template_id is not null and title <> 'Locally hidden';
      update product_templates set active=false, enabled_colors=array['White'] where slug='beanie';`);
    let availability = await db.query(
      `select published,enabled_colors,global_active,global_enabled_colors from products where template_id is not null and title <> 'Locally hidden'`,
    );
    assert.deepEqual(availability.rows, [
      {
        published: true,
        enabled_colors: ["Black"],
        global_active: false,
        global_enabled_colors: ["White"],
      },
    ]);
    await db.exec(
      `update products set global_active=true,global_enabled_colors=null where template_id is not null`,
    );
    assert.deepEqual(
      (
        await db.query(
          `select published,enabled_colors,global_active,global_enabled_colors from products where template_id is not null and title <> 'Locally hidden'`,
        )
      ).rows,
      availability.rows,
      "derived global fields cannot be forged",
    );
    await assert.rejects(
      () =>
        db.exec(
          `update products set template_id=null where template_id is not null`,
        ),
      /association cannot be changed/,
    );
    await db.exec(
      `update product_templates set active=true,enabled_colors=null where slug='beanie'`,
    );
    availability = await db.query(
      `select published,enabled_colors,global_active,global_enabled_colors from products where template_id is not null and title <> 'Locally hidden'`,
    );
    assert.deepEqual(availability.rows, [
      {
        published: true,
        enabled_colors: ["Black"],
        global_active: true,
        global_enabled_colors: null,
      },
    ]);
    assert.deepEqual(
      (
        await db.query(
          `select published,enabled_colors,global_active from products where title='Locally hidden'`,
        )
      ).rows,
      [{ published: false, enabled_colors: ["White"], global_active: true }],
    );
    await db.exec(`update product_templates set active=false where slug='hoodie';
      insert into products(store_id,title,template_id,published) select s.id,'Generated while disabled',t.id,true from stores s cross join product_templates t where s.slug='test' and t.slug='hoodie';`);
    assert.equal(
      (
        await db.query<{ global_active: boolean }>(
          `select global_active from products where title='Generated while disabled'`,
        )
      ).rows[0].global_active,
      false,
    );
    assert.equal(
      (
        await db.query<{ global_active: boolean }>(
          `select global_active from products where template_id is null`,
        )
      ).rows[0].global_active,
      true,
      "legacy products stay available independently",
    );
    await db.exec(`grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
      set role authenticated;set request.jwt.claim.sub='00000000-0000-0000-0000-000000000012';`);
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      0,
      "other user cannot read notifications",
    );
    await assert.rejects(
      () => db.query("select * from notification_emails"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query("select * from claim_lineup_job()"),
      /permission denied/,
    );
    await db.exec(
      `set request.jwt.claim.sub='00000000-0000-0000-0000-000000000011'`,
    );
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      1,
    );
  } finally {
    await db.close();
  }
});
