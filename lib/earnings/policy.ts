export const EARNINGS_POLICY = "owner-margin-70-30-30days-v1";
export const DAY_MS = 86_400_000;
export function earningsDeadline(soldAt: string): string {
  return new Date(new Date(soldAt).getTime() + 30 * DAY_MS).toISOString();
}
export function earningsEligibility(
  soldAt: string,
  qualifiedAt: string | null,
  now: string,
) {
  const deadline = new Date(earningsDeadline(soldAt)).getTime();
  if (qualifiedAt && new Date(qualifiedAt).getTime() <= deadline)
    return "eligible";
  return new Date(now).getTime() >= deadline ? "expired" : "pending";
}
/** Amount-only refunds are allocated proportionately across the entire order. */
export function refundableOwnerShare(
  original: number,
  total: number,
  refunded: number,
) {
  if (
    ![original, total, refunded].every(Number.isSafeInteger) ||
    original < 0 ||
    total <= 0 ||
    refunded < 0 ||
    refunded > total
  )
    throw new Error("Invalid refund amounts");
  return original - Math.round((original * refunded) / total);
}
