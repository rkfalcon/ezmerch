import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const owner = "00000000-0000-0000-0000-000000000001",
  other = "00000000-0000-0000-0000-000000000002";
const store = "00000000-0000-0000-0000-000000000010",
  order = "00000000-0000-0000-0000-000000000020";
test("ledger migration: idempotency, durable qualification, outbox, leases, audit and tenant isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create schema auth; create schema private;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
   create table stores(id uuid primary key,name text,slug text,owner_id uuid,stripe_account_id text,claimed boolean);
   create table orders(id uuid primary key,store_id uuid,subtotal_cents integer,platform_fee_cents integer,stripe_payment_intent_id text);
   create table user_roles(user_id uuid,role text);
   grant select on stores,user_roles to authenticated;
   create table notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid,store_id uuid,title text,message text,href text,event_key text);
   create unique index notification_dedupe on notifications(recipient_id,event_key) where event_key is not null;
   create table notification_emails(notification_id uuid primary key);
   insert into stores values('${store}','Test store','test','${owner}','acct_test',true);
   insert into orders values('${order}','${store}',3000,1740,'pi_test');`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20260918180120_owner_earnings_deadlines.sql",
        "utf8",
      ),
    );
    const record = `select record_owner_earning('${order}','2026-09-18T16:00:00Z',1200)`;
    await db.exec(record);
    await db.exec(record);
    const row = (
      await db.query<{ original_owner_cents: number; deadline_at: Date }>(
        "select * from owner_earnings",
      )
    ).rows[0];
    assert.equal(row.original_owner_cents, 1260);
    assert.equal(
      new Date(row.deadline_at).toISOString(),
      "2026-10-18T16:00:00.000Z",
    );
    assert.equal(
      (await db.query("select * from owner_earning_events")).rows.length,
      1,
    );
    await db.exec(
      `select notify_owner_earning('${order}','sale','Sale','Set up Stripe'); select notify_owner_earning('${order}','sale','Sale','Set up Stripe');`,
    );
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      1,
    );
    await db.exec(
      `select record_payout_readiness('acct_test','2026-10-10T00:00:00Z'); select record_payout_readiness('acct_test','2026-10-15T00:00:00Z');`,
    );
    let qualified = (
      await db.query<{ qualified_at: Date }>(
        "select qualified_at from store_payout_readiness",
      )
    ).rows[0].qualified_at;
    assert.equal(new Date(qualified).toISOString(), "2026-10-10T00:00:00.000Z");
    await db.exec(
      `select record_payout_readiness('acct_test','2026-10-09T00:00:00Z');`,
    );
    qualified = (
      await db.query<{ qualified_at: Date }>(
        "select qualified_at from store_payout_readiness",
      )
    ).rows[0].qualified_at;
    assert.equal(new Date(qualified).toISOString(), "2026-10-09T00:00:00.000Z");
    assert.equal(
      (await db.query("select * from claim_owner_earning()")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from claim_owner_earning()")).rows.length,
      0,
      "live lease prevents another worker",
    );
    await db.exec(`update owner_earnings set status='expired',owner_cents=0;`);
    assert.equal(
      (
        await db.query<{ platform_fee_cents: number }>(
          "select platform_fee_cents from orders",
        )
      ).rows[0].platform_fee_cents,
      3000,
    );
    assert.equal(
      (await db.query("select * from owner_earning_events")).rows.length,
      2,
    );
    await db.exec(
      `set role authenticated; set request.jwt.claim.sub='${other}';`,
    );
    assert.equal(
      (await db.query("select * from owner_earnings")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from owner_earning_events")).rows.length,
      0,
    );
    await db.exec(`set request.jwt.claim.sub='${owner}'`);
    assert.equal(
      (await db.query("select * from owner_earnings")).rows.length,
      1,
    );
    await assert.rejects(
      db.exec(`update owner_earnings set owner_cents=9999`),
      /permission denied/,
    );
    await assert.rejects(
      db.exec(`select record_payout_readiness('acct_test',now())`),
      /permission denied/,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.exec("select * from owner_earnings"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
