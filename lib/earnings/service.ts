import type Stripe from "stripe";
import { stripe } from "../stripe";
import { createAdminClient } from "../supabase/admin";
import { stripeReady } from "../onboarding/validation";
import { EARNINGS_POLICY, earningsDeadline } from "./policy";

export async function recordPayoutReadiness(
  account: Stripe.Account,
  at = new Date().toISOString(),
) {
  if (!stripeReady(account)) return;
  const { error } = await createAdminClient().rpc("record_payout_readiness", {
    p_account: account.id,
    p_at: at,
  });
  if (error) throw error;
}
export async function recordOwnerEarning(
  payment: Stripe.PaymentIntent,
  paidAt: string,
) {
  if (payment.metadata.revenue_split_version !== EARNINGS_POLICY) return;
  const db = createAdminClient();
  const { data: order, error } = await db
    .from("orders")
    .select("id")
    .eq("stripe_payment_intent_id", payment.id)
    .single();
  if (error || !order) throw error ?? new Error("Paid order missing");
  const cost = Number(payment.metadata.production_cost_cents);
  if (!Number.isSafeInteger(cost) || cost < 0)
    throw new Error("Invalid production cost");
  const { error: saveError } = await db.rpc("record_owner_earning", {
    p_order: order.id,
    p_sold_at: paidAt,
    p_production: cost,
  });
  if (saveError) throw saveError;
  await stripe.paymentIntents.update(payment.id, {
    metadata: { order_id: order.id, owner_setup_deadline: earningsDeadline(paidAt) },
  });
}
export async function wakeOwnerEarning(paymentId: string) {
  const db = createAdminClient();
  const { error } = await db.rpc("wake_owner_earning", {
    p_payment: paymentId,
  });
  if (error) throw error;
}
