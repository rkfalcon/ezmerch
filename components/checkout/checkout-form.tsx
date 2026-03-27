"use client";

import { useState } from "react";
import {
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";

interface CheckoutFormProps {
  orderTotals: {
    subtotalCents: number;
    shippingCents: number;
    taxCents: number;
    totalCents: number;
  };
  onSuccess: () => void;
}

export function CheckoutForm({ orderTotals, onSuccess }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPending(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setPending(false);
      return;
    }

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}${window.location.pathname.replace("/checkout", "/order-confirmation")}`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
      setPending(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Order Summary */}
      <div className="rounded-md border p-4 space-y-2">
        <h2 className="font-medium mb-2">Order Summary</h2>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${(orderTotals.subtotalCents / 100).toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Shipping</span>
          <span>
            {orderTotals.shippingCents === 0
              ? "Free"
              : `$${(orderTotals.shippingCents / 100).toFixed(2)}`}
          </span>
        </div>
        {orderTotals.taxCents > 0 && (
          <div className="flex justify-between text-sm">
            <span>Tax</span>
            <span>${(orderTotals.taxCents / 100).toFixed(2)}</span>
          </div>
        )}
        <div className="border-t pt-2 flex justify-between font-medium">
          <span>Total</span>
          <span>${(orderTotals.totalCents / 100).toFixed(2)}</span>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <PaymentElement />

      <Button
        type="submit"
        disabled={!stripe || pending}
        className="w-full"
      >
        {pending
          ? "Processing..."
          : `Pay $${(orderTotals.totalCents / 100).toFixed(2)}`}
      </Button>
    </form>
  );
}
