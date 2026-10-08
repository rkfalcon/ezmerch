import {
  recordOwnerEarning,
  recordPayoutReadiness,
  wakeOwnerEarning,
} from "@/lib/earnings/service";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { createOrderFromPayment } from "@/lib/orders";

// Use service role client for webhook processing (bypasses RLS)
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  const supabase = getAdminClient();

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      await recordPayoutReadiness(
        account,
        new Date(event.created * 1000).toISOString(),
      );
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

      if (existing) {
        await recordOwnerEarning(
          paymentIntent,
          new Date(event.created * 1000).toISOString(),
        );
        break;
      }

      // Parse metadata from checkout
      const metadata = paymentIntent.metadata;
      const items = JSON.parse(metadata.items || "[]");
      const shippingAddress = JSON.parse(metadata.shipping_address || "{}");

      try {
        await createOrderFromPayment({
          storeId,
          printfulStoreId: metadata.printful_store_id || process.env.PRINTFUL_STORE_ID,
          customerId: null, // Guest checkout — could look up by email
          customerEmail: metadata.customer_email,
          stripePaymentIntentId: paymentIntent.id,
          subtotalCents: parseInt(metadata.subtotal_cents || "0", 10),
          shippingCents: parseInt(metadata.shipping_cents || "0", 10),
          taxCents: parseInt(metadata.tax_cents || "0", 10),
          totalCents: paymentIntent.amount,
          platformFeeCents: parseInt(metadata.platform_fee_cents || "0", 10),
          shippingAddress,
          items: items.map(
            (i: {
              productId: string;
              variantKey: string;
              quantity: number;
              priceCents: number;
              printfulSyncVariantId?: number;
            }) => ({
              ...i,
              printfulSyncVariantId:
                i.printfulSyncVariantId ?? parseInt(i.variantKey, 10),
            }),
          ),
        });
        await recordOwnerEarning(
          paymentIntent,
          new Date(event.created * 1000).toISOString(),
        );
      } catch (err) {
        console.error("Order creation failed:", err);
        return NextResponse.json(
          { error: "Order processing failed" },
          { status: 500 },
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;

      if (paymentIntentId) await wakeOwnerEarning(paymentIntentId);
      if (paymentIntentId && charge.refunded) {
        await supabase
          .from("orders")
          .update({ status: "refunded" })
          .eq("stripe_payment_intent_id", paymentIntentId);
      }
      break;
    }

    case "charge.dispute.created":
    case "charge.dispute.closed": {
      const dispute = event.data.object as Stripe.Dispute;
      const chargeId =
        typeof dispute.charge === "string"
          ? dispute.charge
          : dispute.charge?.id;

      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId);
        const paymentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;
        if (paymentId) await wakeOwnerEarning(paymentId);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
