import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdminClient } from "../lib/supabase/admin";
import { lineupFetch } from "../lib/lineup/request";
import { compactGenerationState } from "../lib/lineup/generation-state";
import type { GenerationState } from "../lib/lineup/types";

// Run while background jobs are paused. Default is a read-only size report.
async function main() {
  const apply = process.argv.includes("--apply");
  const db = createAdminClient(lineupFetch);
  const { data, error } = await db
    .from("product_generation_jobs")
    .select("id,state,status,updated_at")
    .neq("status", "running");
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    ...row,
    compact: compactGenerationState(row.state as GenerationState),
  }));
  const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value));
  console.log({
    jobs: rows.length,
    beforeBytes: rows.reduce((n, r) => n + bytes(r.state), 0),
    afterBytes: rows.reduce((n, r) => n + bytes(r.compact), 0),
    apply,
  });
  if (!apply) return;
  const backup = join(
    tmpdir(),
    `ezmerch-lineup-state-backup-${Date.now()}.json`,
  );
  writeFileSync(backup, JSON.stringify(data), { mode: 0o600 });
  console.log({ backup });
  for (const row of rows) {
    if (bytes(row.compact) >= bytes(row.state)) continue;
    const start = Date.now();
    const { data: saved, error } = await db
      .from("product_generation_jobs")
      .update({ state: row.compact })
      .eq("id", row.id)
      .eq("status", row.status)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (error) throw error;
    console.log({
      id: row.id,
      saved: saved?.length === 1,
      ms: Date.now() - start,
    });
    if (Date.now() - start > 5000)
      throw new Error(
        "Stopping compaction: database save exceeded five seconds",
      );
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
