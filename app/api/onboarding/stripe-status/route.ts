import { onboardingStore } from "@/lib/onboarding/store";
import { stripeReady } from "@/lib/onboarding/validation";
import { stripe } from "@/lib/stripe";
export async function GET() {
  try {
    const { store } = await onboardingStore();
    if (!store?.stripe_account_id)
      return Response.json({ ready: false, started: false });
    const account = await stripe.accounts.retrieve(store.stripe_account_id);
    return Response.json({
      ready: stripeReady(account),
      started: true,
      submitted: account.details_submitted,
    });
  } catch {
    return Response.json(
      { error: "Could not check Stripe. Please try again." },
      { status: 400 },
    );
  }
}
