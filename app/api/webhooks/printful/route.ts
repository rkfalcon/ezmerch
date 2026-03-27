import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { PrintfulWebhookEvent } from "@/lib/printful-types";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  // Verify webhook signature
  const webhookSecret = process.env.PRINTFUL_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = request.headers.get("x-printful-webhook-secret");
    if (signature !== webhookSecret) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }
  }

  const body: PrintfulWebhookEvent = await request.json();
  const supabase = getAdminClient();

  switch (body.type) {
    case "package_shipped": {
      const order = body.data.order;
      const shipment = body.data.shipment;
      if (!order) break;

      await supabase
        .from("orders")
        .update({
          status: "shipped",
          tracking_number: shipment?.tracking_number ?? null,
          tracking_url: shipment?.tracking_url ?? null,
        })
        .eq("printful_order_id", order.id);

      break;
    }

    case "order_failed": {
      const order = body.data.order;
      if (!order) break;

      await supabase
        .from("orders")
        .update({
          status: "fulfillment_failed",
          printful_error: `Order failed in Printful (status: ${order.status})`,
        })
        .eq("printful_order_id", order.id);

      break;
    }

    case "order_canceled": {
      const order = body.data.order;
      if (!order) break;

      await supabase
        .from("orders")
        .update({
          status: "failed",
          printful_error: "Order canceled in Printful",
        })
        .eq("printful_order_id", order.id);

      break;
    }

    case "product_synced":
    case "product_updated": {
      // Could update product data in Supabase if needed
      break;
    }
  }

  return NextResponse.json({ received: true });
}
