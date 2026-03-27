import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { storeId } = await request.json();

  const supabase = await createClient();

  // Verify the user owns this store
  const { data: store } = await supabase
    .from("stores")
    .select("id, owner_id, stripe_account_id")
    .eq("id", storeId)
    .single();

  if (!store || store.owner_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let accountId = store.stripe_account_id;

  // Create Express account if one doesn't exist
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: user.email,
      metadata: { store_id: storeId },
    });
    accountId = account.id;

    // Save account ID immediately
    await supabase
      .from("stores")
      .update({ stripe_account_id: accountId })
      .eq("id", storeId);
  }

  // Create Account Link for onboarding
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/store/connect?refresh=true`,
    return_url: `${origin}/dashboard/store/connect?success=true`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
