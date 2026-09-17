import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const adminA = "00000000-0000-0000-0000-0000000000a1";
const adminB = "00000000-0000-0000-0000-0000000000a2";
const owner = "00000000-0000-0000-0000-0000000000c1";
const signup = "00000000-0000-0000-0000-0000000000c2";

async function applyAdminNotificationSchema(db: PGlite) {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(
      id uuid primary key,
      email text,
      raw_user_meta_data jsonb default '{}',
      email_confirmed_at timestamptz
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function auth.role() returns text language sql stable as $$
      select current_setting('request.jwt.claim.role', true)
    $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
  `);
  for (const name of [
    "001_initial_schema.sql",
    "003_claimed_at.sql",
    "20260914190719_product_template_lineup.sql",
    "20260917170416_guided_store_onboarding.sql",
    "20260917183224_sync_printful_availability.sql",
    "20260917200600_admin_lifecycle_notifications.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
}

test("admins are notified once for signup, store create, and store claim", async () => {
  const db = new PGlite();
  try {
    await applyAdminNotificationSchema(db);
    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data) values
        ('${adminA}','admin-a@example.com','{"display_name":"Admin A"}'),
        ('${adminB}','admin-b@example.com','{}');
      insert into user_roles(user_id,role) values ('${adminA}','admin'),('${adminB}','admin');
    `);
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      0,
      "admins created before any admin role exists are not notified",
    );

    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data)
      values ('${signup}','new.user@example.com','{"display_name":"Riley"}');
    `);
    let rows = (
      await db.query<{
        recipient_id: string;
        title: string;
        message: string;
        href: string;
        event_key: string;
        store_id: string | null;
      }>("select recipient_id,title,message,href,event_key,store_id from notifications order by recipient_id")
    ).rows;
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.event_key),
      [`signup:${signup}`, `signup:${signup}`],
    );
    assert.equal(rows[0].title, "New account signup");
    assert.equal(rows[0].href, "/dashboard/admin");
    assert.equal(rows[0].store_id, null);
    assert.match(rows[0].message, /Riley \(new\.user@example.com\) created an account/);
    assert.deepEqual(
      rows.map((row) => row.recipient_id).sort(),
      [adminA, adminB],
    );
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      2,
    );
    assert.equal(
      (
        await db.query(
          `select * from notifications where recipient_id='${signup}'`,
        )
      ).rows.length,
      0,
      "the new customer is not emailed or notified",
    );

    await db.query(`select private.notify_admins($1,$2,$3,$4,$5)`, [
      "New account signup",
      "duplicate",
      "/dashboard/admin",
      `signup:${signup}`,
      null,
    ]);
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      2,
      "signup event_key is idempotent",
    );

    await db.exec(`
      insert into stores(id,name,slug,claim_token,claim_token_expires_at)
      values (
        '00000000-0000-0000-0000-0000000000d1',
        'Acme Merch',
        'acme',
        'claim-token',
        now() + interval '1 day'
      );
    `);
    const created = (
      await db.query<{
        message: string;
        href: string;
        event_key: string;
        store_id: string;
      }>(
        `select message,href,event_key,store_id from notifications where event_key='store-created:00000000-0000-0000-0000-0000000000s1'`,
      )
    ).rows;
    assert.equal(created.length, 2);
    assert.equal(
      created[0].href,
      "/dashboard/admin/stores/00000000-0000-0000-0000-0000000000s1",
    );
    assert.match(
      created[0].message,
      /Acme Merch \(\/acme\) was created and is waiting to be claimed/,
    );
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      4,
    );

    await db.exec(`
      insert into auth.users(id,email,raw_user_meta_data,email_confirmed_at)
      values ('${owner}','owner@example.com','{"display_name":"Casey"}',now());
    `);
    assert.equal(
      (
        await db.query(
          `select * from notifications where event_key='signup:${owner}'`,
        )
      ).rows.length,
      2,
    );

    const claimed = await db.query<{ claim_store: string }>(
      `select claim_store('claim-token','${owner}') as claim_store`,
    );
    assert.equal(claimed.rows[0].claim_store, "00000000-0000-0000-0000-0000000000s1");
    const claimNotes = (
      await db.query<{ message: string; title: string }>(
        `select title,message from notifications where event_key='store-claimed:00000000-0000-0000-0000-0000000000s1'`,
      )
    ).rows;
    assert.equal(claimNotes.length, 2);
    assert.equal(claimNotes[0].title, "Store claimed");
    assert.match(
      claimNotes[0].message,
      /Acme Merch \(\/acme\) was claimed by Casey \(owner@example.com\)/,
    );
    await assert.rejects(
      () => db.query(`select claim_store('claim-token','${owner}')`),
      /Invalid or expired claim token/,
    );
    assert.equal(
      (
        await db.query(
          `select * from notifications where event_key like 'store-claimed:%'`,
        )
      ).rows.length,
      2,
    );

    const onboarded = await db.query<{ id: string }>(
      `select create_onboarding_store($1,'Self Serve',null,'self-serve') as id`,
      [owner],
    );
    const retry = await db.query<{ id: string }>(
      `select create_onboarding_store($1,'Retry',null,'retry') as id`,
      [owner],
    );
    assert.deepEqual(onboarded.rows, retry.rows);
    const onboardingNotes = (
      await db.query<{ event_key: string; message: string }>(
        `select event_key,message from notifications where event_key='store-created:'||$1`,
        [onboarded.rows[0].id],
      )
    ).rows;
    assert.equal(onboardingNotes.length, 2);
    assert.match(
      onboardingNotes[0].message,
      /Self Serve \(\/self-serve\) was created by Casey \(owner@example.com\)/,
    );
    assert.doesNotMatch(onboardingNotes[0].message, /waiting to be claimed/);
    assert.equal(
      (
        await db.query(
          `select * from notifications where store_id=$1 and event_key like 'store-claimed:%'`,
          [onboarded.rows[0].id],
        )
      ).rows.length,
      0,
      "self-serve create is not also a claim event",
    );

    const recipients = await db.query<{ recipient_id: string }>(
      "select distinct recipient_id from notifications",
    );
    assert.deepEqual(
      recipients.rows.map((row) => row.recipient_id).sort(),
      [adminA, adminB],
    );
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      (await db.query("select * from notification_emails")).rows.length,
    );

    await db.exec(
      `update orders set status='fulfillment_failed' where false`,
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('authenticated','private.notify_admins(text,text,text,text,uuid)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
