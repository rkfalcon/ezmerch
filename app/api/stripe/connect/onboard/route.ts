import { stripe } from "@/lib/stripe";
import { lineupStoreAccess } from "@/lib/lineup/access";

export async function POST(request: Request) {
  try {
    const { storeId } = await request.json();
    const { user, db } = await lineupStoreAccess(String(storeId));
    const { data: store, error } = await db
      .from("stores")
      .select(
        "id,name,slug,owner_id,website_url,stripe_account_id,onboarding_started_at",
      )
      .eq("id", storeId)
      .single();
    if (error || !store || store.owner_id !== user.id)
      return Response.json({ error: "Store access denied" }, { status: 403 });
    let accountId = store.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          email: user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_profile: {
            name: store.name,
            url: store.website_url || `https://www.ezmerch.store/${store.slug}`,
          },
          metadata: { store_id: store.id },
        },
        { idempotencyKey: `ezmerch-connect-${store.id}` },
      );
      accountId = account.id;
      const { error: saveError } = await db
        .from("stores")
        .update({ stripe_account_id: accountId })
        .eq("id", store.id);
      if (saveError) throw saveError;
    }
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL || "https://www.ezmerch.store";
    const path = store.onboarding_started_at
      ? "/dashboard/onboarding"
      : "/dashboard/store/connect";
    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${origin}${path}?refresh=true`,
      return_url: `${origin}${path}?${store.onboarding_started_at ? "stripe=returned" : "success=true"}`,
    });
    return Response.json({ url: link.url });
  } catch {
    return Response.json(
      { error: "Could not open Stripe setup. Please try again." },
      { status: 400 },
    );
  }
}
