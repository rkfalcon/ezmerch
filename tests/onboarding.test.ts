import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { onboardingDetails, stripeReady } from "../lib/onboarding/validation";

test("onboarding accepts an optional website and validates store details", () => {
  assert.deepEqual(onboardingDetails(" My store ", "example.com"), {
    name: "My store",
    websiteUrl: "https://example.com/",
  });
  assert.equal(onboardingDetails("My store", "").websiteUrl, null);
  for (const name of [null, " ", "a".repeat(101)])
    assert.throws(() => onboardingDetails(name, ""));
  for (const website of [
    "ftp://example.com",
    "https://user:pass@example.com",
    "bad address",
  ])
    assert.throws(() => onboardingDetails("Store", website));
});
test("selling requires charges, payouts, and active transfers, not just an account ID", () => {
  assert.equal(stripeReady({}), false);
  assert.equal(
    stripeReady({ charges_enabled: true, payouts_enabled: true }),
    false,
  );
  assert.equal(
    stripeReady({
      charges_enabled: true,
      payouts_enabled: false,
      capabilities: { transfers: "active" },
    }),
    false,
  );
  assert.equal(
    stripeReady({
      charges_enabled: false,
      payouts_enabled: true,
      capabilities: { transfers: "active" },
    }),
    false,
  );
  assert.equal(
    stripeReady({
      charges_enabled: true,
      payouts_enabled: true,
      capabilities: { transfers: "pending" },
    }),
    false,
  );
  assert.equal(
    stripeReady({
      charges_enabled: true,
      payouts_enabled: true,
      capabilities: { transfers: "active" },
    }),
    true,
  );
});
test("self-service store creation is confirmed-email only, idempotent, owned, and protected from client launch", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role',true) $$;`);
    await db.exec(
      readFileSync("supabase/migrations/001_initial_schema.sql", "utf8"),
    );
    await db.exec(readFileSync("supabase/migrations/003_claimed_at.sql", "utf8"));
    await db.exec(
      readFileSync(
        "supabase/migrations/20260917170416_guided_store_onboarding.sql",
        "utf8",
      ),
    );
    const owner = "00000000-0000-0000-0000-000000000101";
    await db.exec(`insert into auth.users(id) values ('${owner}');`);
    await assert.rejects(
      db.query(`select create_onboarding_store($1,'Shop',null,'shop')`, [
        owner,
      ]),
      /Confirm your email/,
    );
    await db.exec(
      `update auth.users set email_confirmed_at=now() where id='${owner}'`,
    );
    const first = await db.query(
      `select create_onboarding_store($1,'Shop',null,'shop') as id`,
      [owner],
    );
    const retry = await db.query(
      `select create_onboarding_store($1,'Retry',null,'retry') as id`,
      [owner],
    );
    assert.deepEqual(first.rows, retry.rows);
    const store = (
      await db.query<{ selling_enabled: boolean; owner_id: string }>(
        "select selling_enabled,owner_id from stores",
      )
    ).rows[0];
    assert.equal(store.selling_enabled, false);
    assert.equal(store.owner_id, owner);
    assert.equal(
      (await db.query("select * from user_roles where role='store_owner'")).rows
        .length,
      1,
    );
    const privileges = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('authenticated','public.create_onboarding_store(uuid,text,text,text)','execute') as allowed",
    );
    assert.equal(privileges.rows[0].allowed, false);
    await db.exec("set request.jwt.claim.role='authenticated'");
    await assert.rejects(
      db.exec("update stores set selling_enabled=true"),
      /secure store setup/,
    );
    await assert.rejects(
      db.exec("update stores set stripe_account_id='acct_fake'"),
      /secure store setup/,
    );
    await assert.rejects(
      db.exec("update stores set onboarding_started_at=null"),
      /secure store setup/,
    );
    await db.exec(
      "update stores set name='Updated name'; set request.jwt.claim.role='service_role'; update stores set selling_enabled=true",
    );
    assert.equal(
      (
        await db.query<{ selling_enabled: boolean }>(
          "select selling_enabled from stores",
        )
      ).rows[0].selling_enabled,
      true,
    );
  } finally {
    await db.close();
  }
});
