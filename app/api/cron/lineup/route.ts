import { timingSafeEqual } from "node:crypto";
import { runLineupWorker } from "@/lib/lineup/worker";
import { deliverLineupEmails } from "@/lib/lineup/notifications";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const jobs = await runLineupWorker();
  const emails = await deliverLineupEmails();
  return Response.json({ ...jobs, ...emails });
}
