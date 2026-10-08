import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

test("claimant email is backfilled and maintained for new stores and later claims", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id int primary key, email text);
      create table stores(id int primary key, owner_id int, claimed boolean, owner_email text, claimed_at text);
      insert into auth.users values(1,'owner@example.com'),(2,'other@example.com');
      insert into stores values(1,1,true,null,'original-time');
    `);
    await db.exec(readFileSync("supabase/migrations/20260919153614_store_claim_owner_email.sql", "utf8"));
    assert.deepEqual((await db.query<{owner_email:string | null}>("select owner_email,claimed_at from stores where id=1")).rows[0],
      {owner_email:"owner@example.com",claimed_at:"original-time"});
    await db.exec("insert into stores values(2,2,true,null,null),(3,null,false,null,null); update stores set owner_id=1,claimed=true where id=3;");
    assert.deepEqual((await db.query<{owner_email:string | null}>("select owner_email from stores order by id")).rows.map(r=>r.owner_email),
      ["owner@example.com","other@example.com","owner@example.com"]);
    await db.exec("update stores set owner_email='forged@example.com' where id=1;");
    assert.equal((await db.query<{owner_email:string | null}>("select owner_email from stores where id=1")).rows[0].owner_email,"owner@example.com");
    await db.exec("update stores set owner_id=null,claimed=false where id=1;");
    assert.equal((await db.query<{owner_email:string | null}>("select owner_email from stores where id=1")).rows[0].owner_email,null);
  } finally { await db.close(); }
});
