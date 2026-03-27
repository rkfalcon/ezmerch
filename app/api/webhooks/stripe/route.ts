import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Use service role client for webhook processing (bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  const supabase = getAdminClient();

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.payouts_enabled) {
        // Update the store's Stripe status
        await supabase
          .from("stores")
          .update({ stripe_account_id: account.id })
          .eq("stripe_account_id", account.id);
      }
      break;
    }

    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const storeId = paymentIntent.metadata?.store_id;

      if (!storeId) break;

      // Check for duplicate (idempotency)
      const { data: existing } = await supabase
        .from("orders")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntent.id)
        .single();

      if (existing) break; // Already processed

      // Order creation will be handled in Unit 9
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

      if (paymentIntentId) {
        await supabase
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", paymentIntentId);
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId = typeof dispute.charge === "string"
        ? dispute.charge
        : dispute.charge?.id;

      // Log dispute — detailed handling in Unit 11
      console.log(`Dispute created for charge: ${chargeId}`);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
