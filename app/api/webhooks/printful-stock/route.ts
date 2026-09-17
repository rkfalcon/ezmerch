import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
export async function POST(request: Request) {
  const secret = process.env.PRINTFUL_STOCK_WEBHOOK_SECRET;
  const raw = await request.text();
  const signature = request.headers.get("x-pf-webhook-signature") ?? "";
  if (!secret || !/^[a-f\d]{64}$/i.test(signature))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const expected = createHmac("sha256", Buffer.from(secret, "hex"))
    .update(raw)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  let body;
  try { body = JSON.parse(raw); } catch { return Response.json({error:"Invalid JSON"},{status:400}); }
  if (body.type !== "catalog_stock_updated")
    return Response.json({ received: true });
  // A signed event is only a refresh signal. Provider data is fetched by the worker.
  const db = createAdminClient();
  const { error } = await db
    .from("product_templates")
    .update({ stock_next_check_at: new Date().toISOString() })
    .not("catalog_product_id", "is", null)
    .gt("stock_next_check_at", new Date().toISOString());
  if (error)
    return Response.json({ error: "Unable to queue refresh" }, { status: 503 });
  return Response.json({ received: true });
}
