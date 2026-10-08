import { deliverQueuedEmail } from "@/lib/email/delivery";
import { timingSafeEqual } from "node:crypto";
import { deliverInvitation } from "@/lib/invitations/server";
export const maxDuration = 60;
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
  const invitation = await deliverInvitation();
  const website = await deliverQueuedEmail("website");
  return Response.json({ invitation, website });
}
