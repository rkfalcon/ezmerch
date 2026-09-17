import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { jobStatus } from "../lib/lineup/job-status";
test("provider cooldown and stock shortages are automatic waits, not failed logo uploads", () => {
  assert.equal(
    jobStatus("pending", "Printful 429: too many requests").label,
    "Waiting for Printful",
  );
  assert.equal(
    jobStatus("pending", "No available variants for this product").label,
    "Waiting for stock",
  );
  assert.equal(
    jobStatus("pending", "Printful 429: too many requests").failed,
    false,
  );
  assert.equal(jobStatus("failed", "Bad artwork").failed, true);
  assert.equal(jobStatus("completed", null).message, null);
});
test("shared mockup pacing reserves one slot and delays competing workers", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create schema private;create role anon;create role authenticated;create role service_role;create table product_generation_jobs(status text,attempts int,available_at timestamptz,last_error text);`,
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20260917182232_pace_mockup_requests.sql",
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ delay: number }>(
          "select reserve_lineup_mockup_slot() as delay",
        )
      ).rows[0].delay,
      0,
    );
    const next = (
      await db.query<{ delay: number }>(
        "select reserve_lineup_mockup_slot() as delay",
      )
    ).rows[0].delay;
    assert.ok(next > 30000 && next <= 32000);
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('authenticated','public.reserve_lineup_mockup_slot()','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
