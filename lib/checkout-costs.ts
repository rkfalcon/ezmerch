import { PrintfulClient } from './lineup/printful';

export function dollarsToCents(value: unknown): number {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d+(\.\d{1,2})?$/.test(String(value)))
    throw new Error('Missing or invalid Printful cost');
  const cents = Math.round(Number(value) * 100);
  if (!Number.isSafeInteger(cents)) throw new Error('Invalid Printful cost');
  return cents;
}

export async function quoteCheckoutCosts(
  recipient: object,
  items: Array<{ printfulSyncVariantId: number; quantity: number }>,
  client = new PrintfulClient(),
) {
  const quote = await client.request<{ costs: {
    currency: string; subtotal: string | number; discount: string | number; shipping: string | number;
    digitization?: string | number; additional_fee?: string | number; fulfillment_fee?: string | number;
  } }>('/orders/estimate-costs', {
    shipping: 'STANDARD', recipient,
    items: items.map(item => ({sync_variant_id: item.printfulSyncVariantId, quantity: item.quantity})),
  });
  const costs = quote.costs;
  if (costs?.currency !== 'USD') throw new Error('Missing USD production quote');
  const productionCostCents = dollarsToCents(costs.subtotal) - dollarsToCents(costs.discount)
    + dollarsToCents(costs.digitization ?? '0')
    + dollarsToCents(costs.additional_fee ?? '0')
    + dollarsToCents(costs.fulfillment_fee ?? '0');
  if (productionCostCents < 0) throw new Error('Invalid production quote');
  return { productionCostCents, shippingCents: dollarsToCents(costs.shipping) };
}
