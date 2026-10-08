import { timingSafeEqual } from "node:crypto";
import { processOwnerEarnings } from "@/lib/earnings/worker";
import { deliverLineupEmails } from "@/lib/lineup/notifications";
export const maxDuration = 120;
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Financial reconciliation is independent of paused mockup/catalog jobs.
  const result = await processOwnerEarnings();
  const emails = await deliverLineupEmails(1);
  return Response.json({ ...result, ...emails });
}
