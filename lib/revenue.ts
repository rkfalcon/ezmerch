interface Store {
  claimed: boolean;
  stripe_account_id: string | null;
}

/** Split merchandise margin after Printful production costs, in integer cents.
 * Shipping and tax are retained separately, never paid to the store owner.
 * Stripe processing fees are paid from the platform's retained funds.
 */
export function calculateRevenueSplit(
  store: Store,
  subtotalCents: number,
  productionCostCents: number,
  shippingCents: number,
  taxCents: number,
  reserveOwnerShare = false,
) {
  for (const amount of [
    subtotalCents,
    productionCostCents,
    shippingCents,
    taxCents,
  ]) {
    if (!Number.isSafeInteger(amount) || amount < 0)
      throw new Error("Invalid order amount");
  }
  if (productionCostCents > subtotalCents)
    throw new Error("Product prices do not cover production costs");
  const marginCents = subtotalCents - productionCostCents;
  const hasStripeSetup = store.claimed && !!store.stripe_account_id;
  const ownerEarningsCents =
    hasStripeSetup || reserveOwnerShare ? Math.round(marginCents * 0.7) : 0;
  const platformProfitCents = marginCents - ownerEarningsCents;
  const platformRetainedSubtotalCents = subtotalCents - ownerEarningsCents;
  const totalCents = subtotalCents + shippingCents + taxCents;
  if (!Number.isSafeInteger(totalCents)) throw new Error("Invalid order total");
  return {
    ownerEarningsCents,
    platformProfitCents,
    platformRetainedSubtotalCents,
    // A destination charge transfers the entire charge less this application fee.
    applicationFeeCents: totalCents - ownerEarningsCents,
    destinationAccountId: hasStripeSetup ? store.stripe_account_id : null,
    platformKeepsAll: !hasStripeSetup,
  };
}
