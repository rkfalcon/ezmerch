import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const owner = "00000000-0000-0000-0000-000000000001";
const stranger = "00000000-0000-0000-0000-000000000002";
const store = "00000000-0000-0000-0000-000000000003";
async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table public.stores(id uuid primary key,name text,owner_id uuid,claimed boolean default false,claimed_at timestamptz,claim_token text,claim_token_expires_at timestamptz);
 create table public.user_roles(user_id uuid,role text,store_id uuid,unique(user_id,role,store_id));
 create function public.claim_store(text,uuid) returns uuid language sql as $$select null::uuid$$;
 insert into auth.users values('${owner}','Owner@Example.com',now()),('${stranger}','wrong@example.com',now());
 insert into stores(id,name,claim_token) values('${store}','My Store','old-public-token');
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant all on stores,user_roles to service_role;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20260918185859_store_claim_invitations.sql",
      "utf8",
    ),
  );
  return db;
}
async function issue(db: PGlite, hash = "test-hash") {
  return (
    await db.query<{ id: string }>(
      `select issue_store_invitation($1,$2,$3,$4,$5) as id`,
      [
        store,
        "owner@example.com",
        hash,
        owner,
        JSON.stringify({ subject: "Hello" }),
      ],
    )
  ).rows[0].id;
}
test("recipient-only verified atomic claim; legacy tokens disabled; no replay", async () => {
  const db = await setup();
  try {
    await issue(db);
    assert.equal(
      (
        await db.query<{ claim_token: string | null }>(
          "select claim_token from stores",
        )
      ).rows[0].claim_token,
      null,
    );
    await db.exec(`set role anon`);
    await assert.rejects(
      db.query("select * from store_invitations"),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`select claim_store('old-public-token','${owner}')`),
      /permission denied/,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('test-hash')`),
      /permission denied/,
    );
    await db.exec(
      `reset role; set role authenticated; select set_config('request.jwt.claim.sub','${stranger}',false)`,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('test-hash')`),
      /email address/,
    );
    await assert.rejects(
      db.query(
        `select issue_store_invitation('${store}','x@example.com','h','${owner}','{}')`,
      ),
      /permission denied/,
    );
    await db.exec(
      `reset role; update auth.users set email_confirmed_at=null where id='${owner}'; set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('test-hash')`),
      /verified/,
    );
    await db.exec(
      `reset role; update auth.users set email_confirmed_at=now() where id='${owner}'; set role authenticated`,
    );
    assert.equal(
      (
        await db.query<{ id: string }>(
          `select accept_store_invitation('test-hash') as id`,
        )
      ).rows[0].id,
      store,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('test-hash')`),
      /already accepted/,
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query<{ owner_id: string }>("select owner_id from stores"))
        .rows[0].owner_id,
      owner,
    );
    assert.equal((await db.query("select * from user_roles")).rows.length, 1);
    await assert.rejects(issue(db, "new-hash"), /already claimed/);
  } finally {
    await db.close();
  }
});
test("resend revokes previous link, expiry blocks acceptance, email lease avoids duplicate work", async () => {
  const db = await setup();
  try {
    const old = await issue(db);
    await assert.rejects(issue(db, "new-hash"), /one minute/);
    await db.exec(
      `update store_invitations set created_at=now()-interval '2 minutes'`,
    );
    const id = await issue(db, "new-hash");
    assert.ok(
      (
        await db.query<{ revoked_at: string }>(
          "select revoked_at from store_invitations where id=$1",
          [old],
        )
      ).rows[0].revoked_at,
    );
    const jobs = await db.query<{ id: string }>(
      `select * from claim_store_invitation_email(null)`,
    );
    assert.equal(jobs.rows[0].id, id);
    assert.equal(
      (await db.query(`select * from claim_store_invitation_email(null)`)).rows
        .length,
      0,
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('test-hash')`),
      /invalid/,
    );
    await db.exec(
      `reset role;update store_invitations set expires_at=now() where id='${id}';set role authenticated`,
    );
    await assert.rejects(
      db.query(`select accept_store_invitation('new-hash')`),
      /expired/,
    );
  } finally {
    await db.close();
  }
});
