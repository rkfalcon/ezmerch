import type Stripe from "stripe";
import { createAdminClient } from "../supabase/admin";
import { stripe as defaultStripe } from "../stripe";
import { stripeReady } from "../onboarding/validation";
import { DAY_MS, earningsEligibility, refundableOwnerShare } from "./policy";

type DB = ReturnType<typeof createAdminClient>;
interface Earning {
  order_id: string;
  store_id: string;
  sold_at: string;
  deadline_at: string;
  original_owner_cents: number;
  owner_cents: number;
  status: string;
  stripe_transfer_id: string | null;
  transferred_cents: number;
  reversed_cents: number;
  qualified_at: string | null;
  lock_token: string;
  wake_version: number;
  attempts: number;
}
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export async function processOwnerEarnings(
  limit = 5,
  db: DB = createAdminClient(),
  stripe: Stripe = defaultStripe,
) {
  let processed = 0,
    errors = 0;
  const started = Date.now();
  for (let i = 0; i < limit && Date.now() - started < 40_000; i++) {
    const { data: rows, error } = await db.rpc("claim_owner_earning");
    if (error) throw error;
    const e = rows?.[0] as Earning | undefined;
    if (!e) break;
    async function save(values: Record<string, unknown>) {
      const { data, error: saveError } = await db
        .from("owner_earnings")
        .update({
          ...values,
          locked_until: new Date(0).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", e!.order_id)
        .eq("lock_token", e!.lock_token)
        .eq("wake_version", e!.wake_version)
        .select("order_id");
      if (saveError) throw saveError;
      if (!data?.length) {
        // A webhook woke this row while we worked. Preserve its scheduled retry.
        const { error: releaseError } = await db
          .from("owner_earnings")
          .update({ locked_until: new Date(0).toISOString() })
          .eq("order_id", e!.order_id)
          .eq("lock_token", e!.lock_token);
        if (releaseError) throw releaseError;
      }
    }
    async function notice(kind: string, title: string, message: string) {
      const { error: noticeError } = await db.rpc("notify_owner_earning", {
        p_order: e!.order_id,
        p_kind: kind,
        p_title: title,
        p_message: message,
      });
      if (noticeError) throw noticeError;
    }
    try {
      const { data: store, error: storeError } = await db
        .from("stores")
        .select("id,name,slug,claimed,stripe_account_id,owner_id")
        .eq("id", e.store_id)
        .single();
      const { data: order, error: orderError } = await db
        .from("orders")
        .select("stripe_payment_intent_id,total_cents,subtotal_cents")
        .eq("id", e.order_id)
        .single();
      if (storeError || orderError || !store || !order)
        throw new Error("Could not load earnings order");
      const payment = await stripe.paymentIntents.retrieve(
        order.stripe_payment_intent_id,
        { expand: ["latest_charge"] },
      );
      const charge = payment.latest_charge as Stripe.Charge | null;
      if (
        payment.status !== "succeeded" ||
        !charge ||
        typeof charge === "string"
      )
        throw new Error("Successful charge not available");
      let ready = false;
      if (store.claimed && store.stripe_account_id) {
        const account = await stripe.accounts.retrieve(store.stripe_account_id);
        ready = stripeReady(account);
        if (ready) {
          const { error: readyError } = await db.rpc(
            "record_payout_readiness",
            { p_account: account.id, p_at: new Date().toISOString() },
          );
          if (readyError) throw readyError;
        }
      }
      const { data: readiness, error: readError } = await db
        .from("store_payout_readiness")
        .select("qualified_at,stripe_account_id")
        .eq("store_id", store.id)
        .maybeSingle();
      if (readError) throw readError;
      const observedAt =
        readiness?.stripe_account_id === store.stripe_account_id
          ? readiness?.qualified_at
          : null;
      const qualifiedAt =
        [e.qualified_at, observedAt].filter(Boolean).sort()[0] ?? null;
      const eligibility = earningsEligibility(
        e.sold_at,
        qualifiedAt ?? null,
        new Date().toISOString(),
      );
      let ownerCents = refundableOwnerShare(
        e.original_owner_cents,
        charge.amount,
        charge.amount_refunded,
      );
      // Never transfer disputed funds. A won dispute will wake this order again.
      let disputeOpen = charge.disputed;
      if (disputeOpen) {
        const disputes = await stripe.disputes.list({
          charge: charge.id,
          limit: 1,
        });
        disputeOpen = disputes.data.some(
          (d) => d.status !== "won" && d.status !== "warning_closed",
        );
      }
      if (disputeOpen || eligibility === "expired") ownerCents = 0;
      const group = `earnings_${e.order_id}`;
      // Recover a successful transfer after a process crash, including after Stripe's
      // 24-hour idempotency retention. A transfer group is unique to this order.
      let transfer: Stripe.Transfer | null = e.stripe_transfer_id
        ? await stripe.transfers.retrieve(e.stripe_transfer_id)
        : ((await stripe.transfers.list({ transfer_group: group, limit: 1 }))
            .data[0] ?? null);
      if (transfer && transfer.amount - transfer.amount_reversed > ownerCents) {
        const target = transfer.amount - ownerCents;
        await stripe.transfers.createReversal(
          transfer.id,
          {
            amount: target - transfer.amount_reversed,
            metadata: { order_id: e.order_id },
          },
          { idempotencyKey: `earnings-reverse-${e.order_id}-${target}` },
        );
        transfer = await stripe.transfers.retrieve(transfer.id);
      }
      // A won dispute may restore earnings after its previous transfer was reversed.
      // Leave this rare adjustment for admin review; never silently duplicate a transfer.
      const adjustmentNeeded =
        !!transfer && transfer.amount - transfer.amount_reversed < ownerCents;
      if (
        !transfer &&
        eligibility === "eligible" &&
        ready &&
        ownerCents > 0 &&
        !disputeOpen
      ) {
        transfer = await stripe.transfers.create(
          {
            amount: ownerCents,
            currency: "usd",
            destination: store.stripe_account_id,
            source_transaction: charge.id,
            transfer_group: group,
            description: `VeryMerch · ${store.name} · order ${e.order_id}`.slice(
              0,
              500,
            ),
            metadata: {
              store_id: store.id,
              store_name: store.name,
              order_id: e.order_id,
              policy_version: payment.metadata.revenue_split_version,
            },
          },
          { idempotencyKey: `earnings-transfer-${e.order_id}` },
        );
      }
      let status: string = eligibility;
      if (disputeOpen) status = "disputed";
      else if (charge.refunded) status = "refunded";
      else if (e.original_owner_cents === 0) status = "no_margin";
      else if (transfer && !adjustmentNeeded) status = "transferred";
      else if (adjustmentNeeded) status = "eligible";
      const paymentLabels = {
        owner_earnings_status: status,
        owner_earnings_current_cents: String(ownerCents),
        owner_setup_deadline: e.deadline_at,
        owner_transfer_id: transfer?.id ?? "",
      };
      if (Object.entries(paymentLabels).some(([key, value]) => (payment.metadata[key] ?? "") !== value)) {
        await stripe.paymentIntents.update(payment.id, { metadata: paymentLabels });
      }
      const deadline = new Date(e.deadline_at).toLocaleString("en-US", {
        timeZone: "UTC",
        timeZoneName: "short",
      });
      const base = `${store.name}: order ${e.order_id}. Your 70% share after product and printing costs is ${money(e.original_owner_cents)}. Shipping and tax are excluded.`;
      if (status === "pending") {
        await notice(
          "sale",
          `You made a sale at ${store.name} — set up payouts`,
          `${base} Complete Stripe verification by ${deadline} to collect this share. After that deadline, VeryMerch retains this sale's merchandise margin. Later setup qualifies future sales and earlier sales still within their 30-day windows. Set up payouts: /dashboard/store/connect`,
        );
        const age = (Date.now() - new Date(e.sold_at).getTime()) / DAY_MS;
        const reminder = [28, 21, 7].find((day) => age >= day);
        if (reminder)
          await notice(
            `reminder-${reminder}`,
            `Payout setup reminder for ${store.name}`,
            `${base} Your deadline is ${deadline}. Complete Stripe verification from Your payouts to receive eligible earnings.`,
          );
      } else if (status === "expired") {
        await notice(
          "expired",
          `Payout setup deadline passed for ${store.name}`,
          `The 30-day setup deadline for order ${e.order_id} passed on ${deadline}. VeryMerch retains this sale's merchandise margin. Complete Stripe setup to receive 70% on future sales and any earlier sales still within their 30-day windows.`,
        );
      } else if (status === "transferred") {
        await notice(
          "transferred",
          `Earnings transferred for ${store.name}`,
          `${money(ownerCents)} for order ${e.order_id} was transferred to your Stripe account. Stripe's payout schedule determines when it reaches your bank.`,
        );
      }
      if (adjustmentNeeded)
        await notice(
          "issue",
          "Earnings adjustment needs review",
          `Order ${e.order_id} has ${money(ownerCents)} eligible earnings but its transfer has been partly reversed. Admin reconciliation is required.`,
        );
      // Pending checks are hourly only for connected accounts, daily otherwise.
      // Finalized rows sleep until a refund/dispute/account webhook wakes them.
      const next =
        status === "pending"
          ? Math.min(
              new Date(e.deadline_at).getTime(),
              Date.now() + (store.stripe_account_id ? 3_600_000 : DAY_MS),
            )
          : status === "eligible"
            ? Date.now() + 3_600_000
            : null;
      await save({
        status,
        owner_cents: ownerCents,
        qualified_at: qualifiedAt,
        stripe_transfer_id: transfer?.id ?? null,
        transferred_cents: transfer?.amount ?? 0,
        reversed_cents: transfer?.amount_reversed ?? 0,
        next_check_at: next ? new Date(next).toISOString() : "infinity",
        last_error: adjustmentNeeded
          ? "Transfer adjustment requires admin review"
          : null,
      });
      processed++;
    } catch (err) {
      errors++;
      const message =
        err instanceof Error ? err.message : "Earnings processing failed";
      await save({
        last_error: message.slice(0, 500),
        next_check_at: new Date(
          Date.now() +
            Math.min(3_600_000, 60_000 * 2 ** Math.min(e.attempts, 6)),
        ).toISOString(),
      });
      if (e.attempts >= 3)
        await notice(
          "issue",
          "Owner earnings need attention",
          `Order ${e.order_id} could not be processed. An administrator should review its earnings status. No deadline is finalized while verification is failing.`,
        );
    }
  }
  return { processed, errors };
}
