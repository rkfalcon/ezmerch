import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  timeout: 15_000,
  maxNetworkRetries: 1,
  apiVersion: "2026-03-25.dahlia",
});
