import { timingSafeEqual } from "node:crypto";
import {
  syncSupplierStock,
  refreshStockSubscription,
} from "@/lib/lineup/stock-sync";
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
  if (process.env.BACKGROUND_JOBS_PAUSED === "true")
    return Response.json({ paused: true });
  const jobs = await syncSupplierStock();
  await refreshStockSubscription();
  const emails = await deliverLineupEmails();
  return Response.json({ ...jobs, ...emails });
}
