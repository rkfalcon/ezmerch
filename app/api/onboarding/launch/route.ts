import { onboardingStore } from "@/lib/onboarding/store";
import { stripeReady } from "@/lib/onboarding/validation";
import { stripe } from "@/lib/stripe";
import { revalidatePath } from "next/cache";
export async function POST() {
  try {
    const { store, db } = await onboardingStore();
    if (!store?.onboarding_started_at || !store.stripe_account_id)
      throw new Error("Complete Stripe setup first.");
    if (!stripeReady(await stripe.accounts.retrieve(store.stripe_account_id)))
      throw new Error(
        "Stripe has not finished verifying your payment and payout details. Continue Stripe setup or check again shortly.",
      );
    const { count, error } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("published", true)
      .eq("global_active", true);
    if (error) throw error;
    if (!count)
      throw new Error(
        "Your products are still being prepared. You can start selling as soon as the first product is ready.",
      );
    const { error: saveError } = await db
      .from("stores")
      .update({ selling_enabled: true })
      .eq("id", store.id);
    if (saveError) throw saveError;
    revalidatePath("/");
    revalidatePath(`/${store.slug}`, "layout");
    revalidatePath("/dashboard", "layout");
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not launch the store.",
      },
      { status: 400 },
    );
  }
}
