import { productReadyEmail } from "./product-ready-email";
import { createAdminClient } from "../supabase/admin";
import { storeLaunchEmail } from "./store-launch-email";
import { stripeReady } from "../onboarding/validation";

export async function deliverLineupEmails(limit = 5) {
  // Keep queued notifications untouched while email delivery is deferred.
  if (process.env.LINEUP_EMAIL_ENABLED !== "true") return { sent: 0 };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !origin)
    throw new Error(
      "Email delivery is enabled but Resend configuration is incomplete",
    );
  const db = createAdminClient();
  const { error: launchError } = await db.rpc("enqueue_store_launch_emails");
  if (launchError) throw launchError;
  let sent = 0;
  for (let index = 0; index < limit; index++) {
    const { data: claims, error: claimError } =
      await db.rpc("claim_lineup_email");
    if (claimError) throw claimError;
    const email = claims?.[0];
    if (!email) break;
    try {
      const { data: notification, error } = await db
        .from("notifications")
        .select("*")
        .eq("id", email.notification_id)
        .single();
      if (error || !notification)
        throw new Error("Notification could not be loaded");
      const { data: user, error: userError } = await db.auth.admin.getUserById(
        notification.recipient_id,
      );
      if (userError || !user.user?.email)
        throw new Error("Recipient has no email address");
      let content: { subject: string; text: string; html?: string } = {
        subject: notification.title,
        text: `${notification.message}\n\nView details: ${new URL(notification.href, origin).href}`,
      };
      if (notification.event_key?.startsWith("store-launch:")) {
        const { data: store, error: storeError } = await db.from("stores")
          .select("name,owner_id,selling_enabled,stripe_account_id,claimed")
          .eq("id", notification.store_id).single();
        if (storeError || !store) throw new Error("Store details are not available");
        let payoutReady = false;
        if (store.stripe_account_id) {
          const { stripe } = await import("../stripe");
          const { recordPayoutReadiness } = await import("../earnings/service");
          const account = await stripe.accounts.retrieve(store.stripe_account_id);
          payoutReady = stripeReady(account);
          if (payoutReady) await recordPayoutReadiness(account);
        }
        const { data: products, error: productsError } = await db.from("products")
          .select("id,variants").eq("store_id", notification.store_id)
          .eq("published", true).eq("global_active", true).not("thumbnail_url", "is", null);
        if (productsError) throw productsError;
        if (!store.claimed || store.owner_id !== notification.recipient_id ||
            (store.selling_enabled && payoutReady) || !products?.some(p => p.variants?.length)) {
          const {error} = await db.from("notification_emails").update({status:"skipped",last_error:"Setup complete, owner changed, or no ready products"})
            .eq("notification_id", email.notification_id);
          if (error) throw error;
          continue;
        }
        content = storeLaunchEmail({name:store.name,launched:store.selling_enabled,payoutReady,
          reminder:!notification.event_key.endsWith(":0"),origin});
      }
      if (notification.event_key?.startsWith("template-disabled:")) {
        const { data: store, error: storeError } = await db
          .from("stores").select("name").eq("id", notification.store_id).single();
        if (storeError || !store) throw new Error("Store details are not available");
        const productTitle = notification.title.replace(/^Product disabled: /, "");
        content.text = `${productTitle} has been disabled by VeryMerch and is no longer available for purchase in ${store.name}. But worry not, there are still plenty of amazing products available in your store!\n\nView details: ${new URL(notification.href, origin).href}\n\nIf you have any issues or concerns please let us know at help@verymerch.com`;
      }
      if (notification.product_id && notification.title === "New product ready to review") {
        const [{data: product, error: productError}, {data: store, error: storeError}] = await Promise.all([
          db.from("products").select("title,thumbnail_url,published").eq("id", notification.product_id).eq("store_id", notification.store_id).single(),
          db.from("stores").select("name,slug").eq("id", notification.store_id).single(),
        ]);
        if (productError || storeError || !product?.thumbnail_url || !store)
          throw new Error("Branded product preview is not available yet");
        content = productReadyEmail({storeName: store.name, storeSlug: store.slug,
          productTitle: product.title, imageUrl: product.thumbnail_url,
          published: product.published, dashboardPath: notification.href, origin});
      }
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `lineup-${notification.id}`,
        },
        body: JSON.stringify({
          from,
          to: [user.user.email],
          ...content,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const reason = typeof details?.message === "string"
          ? details.message.replaceAll(apiKey, "[redacted]").slice(0, 500)
          : "No provider details available";
        throw new Error(`Email provider returned ${response.status}: ${reason}`);
      }
      const { error: saveError } = await db
        .from("notification_emails")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("notification_id", email.notification_id);
      if (saveError) throw saveError;
      sent++;
    } catch (error) {
      const { error: saveError } = await db
        .from("notification_emails")
        .update({
          status: email.attempts >= 5 ? "failed" : "pending",
          last_error:
            error instanceof Error ? error.message : "Email delivery failed",
          available_at: new Date(
            Date.now() + Math.min(3600_000, 60_000 * 2 ** email.attempts),
          ).toISOString(),
        })
        .eq("notification_id", email.notification_id);
      if (saveError) throw saveError;
    }
  }
  return { sent };
}
