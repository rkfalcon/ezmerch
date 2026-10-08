import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("enhancement reservation is owner-scoped, single-use, rate limited and private", async () => {
  const db = new PGlite();
  const user = "00000000-0000-0000-0000-000000000001",
    other = "00000000-0000-0000-0000-000000000002",
    id = "00000000-0000-0000-0000-000000000003";
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);insert into auth.users values('${user}'),('${other}');`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20260918193044_logo_print_quality.sql",
        "utf8",
      ),
    );
    await db.exec(
      `insert into logo_preparations(id,user_id,source_hash,metadata) values('${id}','${user}','hash','{}');set role service_role;`,
    );
    const reserve = (who = user) =>
      db.query<{ reserved: boolean }>(
        "select reserve_logo_enhancement($1,$2) as reserved",
        [id, who],
      );
    assert.equal((await reserve(other)).rows[0].reserved, false);
    assert.equal((await reserve()).rows[0].reserved, true);
    assert.equal((await reserve()).rows[0].reserved, false);
    await db.exec(
      `reset role;insert into logo_preparations(user_id,source_hash,metadata,enhancement_started_at) select '${user}',g::text,'{}',now() from generate_series(1,9) g;set role service_role;`,
    );
    await assert.rejects(reserve(), /ten logos/);
    await db.exec("reset role;set role authenticated");
    await assert.rejects(reserve(), /permission denied/);
    await assert.rejects(
      db.query("select * from logo_preparations"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
