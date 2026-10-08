import { send } from "@vercel/queue";
import { createAdminClient } from "../supabase/admin";

export function lineupQueueEnabled() {
  return process.env.VERCEL_ENV === "production" &&
    process.env.LINEUP_QUEUE_DISABLED !== "true" &&
    process.env.BACKGROUND_JOBS_PAUSED !== "true";
}

export function wakeupOptions(availableAt: string | null, now = Date.now()) {
  if (!availableAt) return null;
  const at = Date.parse(availableAt);
  // Longer stock/retry delays remain covered by the recovery cron.
  if (!Number.isFinite(at) || at - now > 60000) return null;
  const delaySeconds = Math.max(3, Math.ceil((at - now) / 1000));
  return { delaySeconds, idempotencyKey: `lineup-${Math.floor((now + delaySeconds * 1000) / 3000)}` };
}

export async function scheduleLineupWakeup(force = false) {
  if (!lineupQueueEnabled()) return;
  const { data, error } = await createAdminClient().rpc("next_lineup_wakeup");
  if (error) throw error;
  const options = wakeupOptions(force ? new Date().toISOString() : data);
  if (options) {
    const result = await send("lineup-work", { version: 1 }, options);
    console.info("lineup.queue_scheduled", { messageId: result.messageId, delaySeconds: options.delaySeconds });
    return true;
  }
  return false;
}

/** Cron and uploads retain their direct worker as a fallback when queue delivery is unavailable. */
export async function tryScheduleLineupWakeup(force = false) {
  try { return await scheduleLineupWakeup(force); }
  catch (error) { console.error("lineup.queue_schedule_failed", error instanceof Error ? error.message : "Unavailable"); }
}
