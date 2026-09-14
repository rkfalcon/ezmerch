import { runLineupWorker } from "../lib/lineup/worker";
import { deliverLineupEmails } from "../lib/lineup/notifications";

// A supervised process is an alternative to calling the authenticated cron route.
async function main() {
  const once = process.argv.includes("--once");
  do {
    try {
      console.log({
        ...(await runLineupWorker()),
        ...(await deliverLineupEmails()),
      });
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Lineup worker failed",
      );
      if (once) process.exitCode = 1;
    }
    if (!once) await new Promise((resolve) => setTimeout(resolve, 15_000));
  } while (!once);
}
void main();
