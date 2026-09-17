// Run with: node --env-file=.env.local --import tsx scripts/diagnose-lineup.mjs [baseline|step]
// A step advances ONE real queued job. Production pause settings are not changed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const mode = process.argv[2] ?? "baseline";
if (!["baseline", "step"].includes(mode))
  throw new Error("Use baseline or step");
const file = path.join(
  os.tmpdir(),
  `ezmerch-lineup-${Date.now()}-${mode}.jsonl`,
);
const write = (v) => {
  let x = { at: new Date().toISOString(), ...v };
  fs.appendFileSync(file, JSON.stringify(x) + "\n");
  console.log(JSON.stringify(x));
};
const base = globalThis.fetch;
function operation(u, method) {
  if (u.includes("/rpc/")) return u.split("/rpc/")[1].split("?")[0];
  if (u.includes("/storage/"))
    return method === "POST" ? "storage-upload" : "storage-download";
  if (u.includes("/rest/v1/product_generation_jobs"))
    return method === "PATCH" ? "save-state" : "read-state";
  if (u.includes("api.printful.com"))
    return "printful:" + new URL(u).pathname.replace(/@[\w-]+/g, "@id");
  return "asset-download";
}
async function probe() {
  let ok = true;
  for (let [name, u, h] of [
    ["home", "https://www.ezmerch.store/", {}],
    ["store", "https://www.ezmerch.store/mazellist", {}],
    [
      "db",
      process.env.NEXT_PUBLIC_SUPABASE_URL +
        "/rest/v1/stores?select=id&limit=1",
      {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: "Bearer " + process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    ],
  ]) {
    let t = Date.now();
    try {
      const r = await base(u, {
        headers: h,
        signal: AbortSignal.timeout(8000),
      });
      await r.arrayBuffer();
      let ms = Date.now() - t;
      write({ probe: name, ms, status: r.status });
      ok &&= r.ok && ms < 5000;
    } catch (e) {
      write({ probe: name, ms: Date.now() - t, error: e.name });
      ok = false;
    }
  }
  return ok;
}
if (!(await probe())) {
  write({ skipped: "unhealthy baseline" });
  process.exit(0);
}
if (mode === "step") {
  globalThis.fetch = async (input, init = {}) => {
    let u = typeof input === "string" ? input : (input.url ?? String(input));
    let method = init.method ?? input.method ?? "GET";
    let op = operation(u, method),
      t = Date.now();
    const signals = [
      AbortSignal.timeout(15000),
      init.signal ?? input.signal,
    ].filter(Boolean);
    write({
      operation: op,
      event: "start",
      requestBytes:
        typeof init.body === "string"
          ? Buffer.byteLength(init.body)
          : (init.body?.byteLength ?? null),
    });
    try {
      const r = await base(input, {
        ...init,
        signal: AbortSignal.any(signals),
      });
      const bytes = await r.arrayBuffer();
      write({
        operation: op,
        event: "end",
        ms: Date.now() - t,
        status: r.status,
        responseBytes: bytes.byteLength,
      });
      const headers = new Headers(r.headers);
      headers.delete("content-encoding");
      headers.delete("content-length");
      return new Response(r.status === 204 ? null : bytes, {
        status: r.status,
        statusText: r.statusText,
        headers,
      });
    } catch (e) {
      write({
        operation: op,
        event: "error",
        ms: Date.now() - t,
        error: e.name,
      });
      throw e;
    }
  };
  process.env.BACKGROUND_JOBS_PAUSED = "false";
  let done = false;
  const monitor = (async () => {
    await new Promise((r) => setTimeout(r, 3000));
    if (!done) await probe();
  })();
  try {
    const { runLineupWorker } = await import("../lib/lineup/worker.ts");
    write({ result: await runLineupWorker() });
  } catch (e) {
    write({ error: e.message });
  } finally {
    done = true;
    await monitor;
    globalThis.fetch = base;
  }
  await probe();
}
write({ file });
