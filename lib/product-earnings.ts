import { calculateRevenueSplit } from "./revenue";
export type PricedVariant = { variant_id: number; retail_price: string; size?: string | null };
export function earningsEstimate(variants: PricedVariant[], costs: Record<string, number>, proposedCents?: number) {
  if (!variants.length) return null;
  const prices: number[] = [], earnings: number[] = [], production: number[] = [];
  for (const variant of variants) {
    const price = proposedCents ?? Math.round(Number(variant.retail_price) * 100);
    const cost = costs[String(variant.variant_id)];
    if (!Number.isSafeInteger(price) || price <= 0 || !Number.isSafeInteger(cost) || cost < 0) return null;
    if (cost > price) return { belowCost: true as const };
    prices.push(price);
    production.push(cost);
    earnings.push(calculateRevenueSplit({claimed:true,stripe_account_id:null},price,cost,0,0,true).ownerEarningsCents);
  }
  return { belowCost: false as const, priceMin: Math.min(...prices), priceMax: Math.max(...prices), profitMin: Math.min(...earnings), profitMax: Math.max(...earnings), costMin: Math.min(...production), costMax: Math.max(...production) };
}
export function moneyRange(min: number, max: number) {
  const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  return min === max ? money(min) : `${money(min)}–${money(max)}`;
}
