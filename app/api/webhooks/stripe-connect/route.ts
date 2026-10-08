import { stripe } from "@/lib/stripe";
import { recordPayoutReadiness } from "@/lib/earnings/service";
import type Stripe from "stripe";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return Response.json(
      { error: "Missing webhook configuration or signature" },
      { status: 400 },
    );
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }
  if (event.type === "account.updated")
    await recordPayoutReadiness(
      event.data.object as Stripe.Account,
      new Date(event.created * 1000).toISOString(),
    );
  return Response.json({ received: true });
}
