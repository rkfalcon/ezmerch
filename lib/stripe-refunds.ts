import type Stripe from 'stripe';

export function refundParameters(payment: Pick<Stripe.PaymentIntent, 'id' | 'transfer_data'>): Stripe.RefundCreateParams {
  return {
    payment_intent: payment.id,
    ...(payment.transfer_data?.destination
      ? { reverse_transfer: true, refund_application_fee: true }
      : {}),
  };
}
