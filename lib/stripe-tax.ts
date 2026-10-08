import type Stripe from 'stripe';

const apparelCategories = new Set([
  'T-Shirts', 'Long Sleeve Shirts', 'Hoodies & Sweatshirts', 'Tank Tops',
  'Pants & Shorts', 'Dresses & Skirts', 'Outerwear', 'Polo Shirts',
]);

/** Always override the account fallback: this checkout sells physical merchandise.
 * Mixed categories (Kids & Baby, accessories) use tangible goods rather than
 * incorrectly granting every item a clothing exemption.
 */
export function taxCodeForProduct(category: string | null | undefined): string {
  if (apparelCategories.has(category ?? '')) return 'txcd_30011000';
  if (category === 'Hats & Beanies') return 'txcd_30060006';
  return 'txcd_99999999';
}

export interface TaxItem {
  reference: string;
  priceCents: number;
  quantity: number;
  taxCode: string;
}
interface Address {
  address1: string; address2?: string; city: string;
  state_code: string; country_code: string; zip: string;
}
export async function calculateOrderTax(
  client: Pick<Stripe, 'tax'>,
  items: TaxItem[],
  address: Address,
  shippingCents: number,
) {
  const subtotal = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
  const calculation = await client.tax.calculations.create({
    currency: 'usd',
    customer_details: {
      address_source: 'shipping',
      address: {
        line1: address.address1, line2: address.address2,
        city: address.city, state: address.state_code,
        country: address.country_code, postal_code: address.zip,
      },
    },
    line_items: items.map(item => ({
      // Stripe expects the total for this line, not the unit price.
      amount: item.priceCents * item.quantity,
      quantity: item.quantity,
      reference: item.reference,
      tax_code: item.taxCode,
      tax_behavior: 'exclusive',
    })),
    shipping_cost: {
      amount: shippingCents, tax_behavior: 'exclusive',
      tax_code: 'txcd_92010001', // Shipping: tax treatment follows the merchandise.
    },
  });
  if (!calculation?.id || !Number.isSafeInteger(calculation.tax_amount_exclusive)
      || calculation.tax_amount_exclusive < 0 || calculation.tax_amount_inclusive !== 0
      || calculation.amount_total !== subtotal + shippingCents + calculation.tax_amount_exclusive)
    throw new Error('Invalid tax calculation');
  return { calculationId: calculation.id, totalCents: calculation.amount_total,
    taxCents: calculation.tax_amount_exclusive };
}
