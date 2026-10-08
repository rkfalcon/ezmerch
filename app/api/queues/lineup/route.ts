import { handleCallback } from "@vercel/queue";
import { lineupQueueEnabled, scheduleLineupWakeup } from "@/lib/lineup/queue";
import { runLineupWorker } from "@/lib/lineup/worker";

export const maxDuration = 300;
export const POST = handleCallback(async () => {
  if (!lineupQueueEnabled()) return;
  const started = Date.now();
  const result = await runLineupWorker();
  console.info("lineup.queue_run", { ...result, elapsedMs: Date.now() - started });
  // A scheduling failure throws so durable delivery retries; DB leases make repeat work safe.
  await scheduleLineupWakeup();
});
