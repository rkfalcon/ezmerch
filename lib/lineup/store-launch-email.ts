export function storeLaunchEmail(input: {
  name: string; launched: boolean; payoutReady: boolean; reminder: boolean; origin: string;
}) {
  const setup = new URL('/dashboard/onboarding', input.origin).href;
  const payouts = new URL('/dashboard/store/connect', input.origin).href;
  const subject = input.reminder
    ? `${input.name}: ${input.launched ? 'finish your VeryMerch payout setup' : 'your VeryMerch store is ready to launch'}`
    : `${input.name} is ready on VeryMerch!`;
  const paragraphs = [
    input.launched ? `Your ${input.name} store is launched and has products ready to sell.`
      : `Your ${input.name} store has products ready! Launch now to make them available to customers. You can launch and start selling without completing Stripe payout setup.`,
    !input.launched ? `Launch your store: ${setup}` : '',
    input.payoutReady ? 'Your Stripe payout setup is complete.'
      : `Complete Stripe verification to receive your earnings. Launching your store does not require Stripe setup, but receiving payouts does.\n\nSet up payouts: ${payouts}`,
    'You receive 70% of the merchandise profit after product and printing costs; VeryMerch receives 30%. Shipping and tax are excluded from this split. Your selling price and production costs determine your earnings.',
    !input.payoutReady ? 'Complete Stripe verification within 30 days of each sale to receive that sale’s eligible earnings. Each sale has its own deadline. If its deadline passes before you qualify, VeryMerch retains that sale’s merchandise margin. Completing setup later qualifies future sales and earlier sales still within their 30-day windows. Your Earnings dashboard shows your earnings and deadlines.' : '',
    !input.payoutReady ? `View earnings and deadlines: ${new URL('/dashboard/store/earnings',input.origin).href}` : '',
    'Additional product colors may still be generating. Your dashboard shows progress, and we will email you when all available product colors are complete.',
    'Questions? Contact help@verymerch.com.\n\nVeryMerch',
  ].filter(Boolean);
  return {subject, text: paragraphs.join('\n\n')};
}
