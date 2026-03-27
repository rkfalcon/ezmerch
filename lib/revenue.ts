interface Store {
  claimed: boolean;
  stripe_account_id: string | null;
}

interface RevenueSplit {
  applicationFeeCents: number;
  destinationAccountId: string | null;
  platformKeepsAll: boolean;
}

/**
 * Calculate the revenue split for a given order.
 *
 * Split applies to product subtotal only — shipping and tax are excluded.
 * Both claimed === true AND a valid stripe_account_id are required for payouts.
 *
 * - Unclaimed or no Stripe: platform keeps 100%
 * - Claimed + Stripe: 40% platform fee, 60% to store owner
 */
export function calculateRevenueSplit(
  store: Store,
  subtotalCents: number
): RevenueSplit {
  const hasStripeSetup = store.claimed && !!store.stripe_account_id;

  if (!hasStripeSetup) {
    return {
      applicationFeeCents: 0,
      destinationAccountId: null,
      platformKeepsAll: true,
    };
  }

  // 40% platform fee on subtotal
  const applicationFeeCents = Math.round(subtotalCents * 0.4);

  return {
    applicationFeeCents,
    destinationAccountId: store.stripe_account_id,
    platformKeepsAll: false,
  };
}
