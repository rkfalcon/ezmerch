"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserWithRole } from "@/lib/auth";
import { refundParameters } from "@/lib/stripe-refunds";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";

export async function issueRefund(orderId: string) {
  const user = await getUserWithRole();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  // Fetch the order
  const { data: order } = await supabase
    .from("orders")
    .select("id, store_id, stripe_payment_intent_id, status")
    .eq("id", orderId)
    .single();

  if (!order) {
    return { error: "Order not found" };
  }

  // Authorization: admin can refund any order, store owner only their store's orders
  if (!user.isAdmin) {
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", order.store_id)
      .single();

    if (!store || store.owner_id !== user.id) {
      return { error: "Forbidden" };
    }
  }

  if (order.status === "refunded") {
    return { error: "Order has already been refunded" };
  }

  if (!order.stripe_payment_intent_id) {
    return { error: "No payment found for this order" };
  }

  try {
    const payment = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    // Stripe also reverses tax recorded through the linked tax calculation.
    const refund = await stripe.refunds.create(refundParameters(payment), {
      idempotencyKey: `ezmerch-full-refund-${order.id}`,
    });
    if (refund.status !== "succeeded")
      return { error: "The refund is pending. Its status will update when Stripe confirms it." };

    await supabase
      .from("orders")
      .update({ status: "refunded" })
      .eq("id", orderId);

    revalidatePath("/dashboard/admin/orders");
    revalidatePath("/dashboard/store/orders");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refund failed";
    return { error: message };
  }
}
