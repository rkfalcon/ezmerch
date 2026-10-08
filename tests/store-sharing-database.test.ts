import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("instruction emails enforce ownership, verification, deduplication, throttling and private leased delivery", async () => {
  const db = new PGlite();
  const owner = "00000000-0000-0000-0000-000000000001",
    other = "00000000-0000-0000-0000-000000000002",
    store = "00000000-0000-0000-0000-000000000003",
    id = "00000000-0000-0000-0000-000000000004",
    next = "00000000-0000-0000-0000-000000000005";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create table stores(id uuid primary key,owner_id uuid,claimed boolean);insert into auth.users values('${owner}',now()),('${other}',now());insert into stores values('${store}','${owner}',true);`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20260918191345_store_sharing_emails.sql",
        "utf8",
      ),
    );
    const queue = (who = owner, request = id) =>
      db.query("select queue_store_website_email($1,$2,$3,$4,$5) as id", [
        request,
        store,
        who,
        "DEV@example.com",
        JSON.stringify({ subject: "Instructions" }),
      ]);
    await assert.rejects(queue(other), /own/);
    await db.exec(
      `update auth.users set email_confirmed_at=null where id='${owner}'`,
    );
    await assert.rejects(queue(), /Verify/);
    await db.exec(
      `update auth.users set email_confirmed_at=now() where id='${owner}'`,
    );
    await db.exec("set role service_role");
    await queue();
    await queue();
    await db.exec("reset role");
    assert.equal(
      (await db.query("select * from store_website_emails")).rows.length,
      1,
    );
    await assert.rejects(queue(owner, next), /one minute/);
    assert.equal(
      (await db.query("select * from claim_store_website_email(null)")).rows
        .length,
      1,
    );
    assert.equal(
      (await db.query("select * from claim_store_website_email(null)")).rows
        .length,
      0,
    );
    await db.exec(
      `update store_website_emails set available_at=now(),created_at=now()-interval '24 hours'`,
    );
    assert.equal(
      (await db.query("select * from claim_store_website_email(null)")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query<{ email_status: string }>(
          "select email_status from store_website_emails",
        )
      ).rows[0].email_status,
      "failed",
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select * from store_website_emails"),
      /permission denied/,
    );
    await assert.rejects(queue(), /permission denied/);
    await assert.rejects(
      db.query("select * from claim_store_website_email(null)"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
