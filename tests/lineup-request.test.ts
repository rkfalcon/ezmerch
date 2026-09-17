import test from "node:test";
import assert from "node:assert/strict";
import { lineupFetch } from "../lib/lineup/request";

test("worker requests always have a deadline and preserve caller cancellation", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = async (_input, init) => {
    signal = init?.signal;
    return Response.json({ ok: true });
  };
  try {
    await lineupFetch("https://example.com");
    assert.ok(signal instanceof AbortSignal);
    await lineupFetch(
      new Request("https://example.com", { signal: controller.signal }),
    );
    assert.equal(signal?.aborted, false);
    controller.abort();
    assert.equal(signal?.aborted, true);
  } finally {
    globalThis.fetch = original;
  }
});
