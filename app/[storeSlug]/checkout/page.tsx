"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { useCart } from "@/components/storefront/cart-provider";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { createClient } from "@/lib/supabase/client";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const storeSlug = params.storeSlug as string;
  const { items, totalCents, clearCart } = useCart();

  const [storeId, setStoreId] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderTotals, setOrderTotals] = useState({
    subtotalCents: 0,
    shippingCents: 0,
    taxCents: 0,
    totalCents: 0,
  });

  // Fetch store ID
  useEffect(() => {
    async function loadStore() {
      const supabase = createClient();
      const { data } = await supabase
        .from("stores")
        .select("id")
        .eq("slug", storeSlug)
        .single();
      if (data) setStoreId(data.id);
    }
    loadStore();
  }, [storeSlug]);

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0 && !clientSecret) {
      router.push(`/${storeSlug}`);
    }
  }, [items, clientSecret, storeSlug, router]);

  async function handleCreatePayment(
    shippingAddress: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state_code: string;
      country_code: string;
      zip: string;
    },
    customerEmail: string,
    shippingCents: number
  ) {
    if (!storeId) return;

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        items: items.map((i) => ({
          productId: i.productId,
          variantKey: i.variantKey,
          quantity: i.quantity,
        })),
        shippingAddress,
        customerEmail,
        shippingCents,
        taxCents: 0, // Stripe Tax handles this
      }),
    });

    const data = await res.json();
    if (data.clientSecret) {
      setClientSecret(data.clientSecret);
      setOrderTotals({
        subtotalCents: data.subtotalCents,
        shippingCents: data.shippingCents,
        taxCents: data.taxCents,
        totalCents: data.totalCents,
      });
    }

    return data;
  }

  function handlePaymentSuccess() {
    clearCart();
    router.push(`/${storeSlug}/order-confirmation`);
  }

  if (items.length === 0 && !clientSecret) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      {clientSecret ? (
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}
        >
          <CheckoutForm
            orderTotals={orderTotals}
            onSuccess={handlePaymentSuccess}
          />
        </Elements>
      ) : (
        <ShippingStep
          storeId={storeId}
          items={items}
          subtotalCents={totalCents}
          onSubmit={handleCreatePayment}
        />
      )}
    </div>
  );
}

function ShippingStep({
  storeId,
  items,
  subtotalCents,
  onSubmit,
}: {
  storeId: string | null;
  items: Array<{ productId: string; variantKey: string; title: string; priceCents: number; quantity: number }>;
  subtotalCents: number;
  onSubmit: (
    address: {
      name: string;
      address1: string;
      address2?: string;
      city: string;
      state_code: string;
      country_code: string;
      zip: string;
    },
    email: string,
    shippingCents: number
  ) => Promise<{ error?: string }>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shippingCents, setShippingCents] = useState<number | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);

  async function fetchShipping(formData: FormData) {
    if (!storeId) return;
    setShippingLoading(true);

    const address = {
      address1: formData.get("address1") as string,
      city: formData.get("city") as string,
      state_code: formData.get("state_code") as string,
      country_code: "US",
      zip: formData.get("zip") as string,
    };

    try {
      const res = await fetch("/api/checkout/shipping-rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          address,
          items: items.map((i) => ({
            printful_variant_id: parseInt(i.variantKey, 10),
            quantity: i.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (data.shippingCents !== undefined) {
        setShippingCents(data.shippingCents);
      } else {
        setError(data.error || "Could not calculate shipping");
      }
    } catch {
      setError("Failed to calculate shipping");
    }
    setShippingLoading(false);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    const address = {
      name: formData.get("name") as string,
      address1: formData.get("address1") as string,
      address2: (formData.get("address2") as string) || undefined,
      city: formData.get("city") as string,
      state_code: formData.get("state_code") as string,
      country_code: "US",
      zip: formData.get("zip") as string,
    };
    const email = formData.get("email") as string;

    const result = await onSubmit(address, email, shippingCents || 0);
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Order Summary */}
      <div className="rounded-md border p-4">
        <h2 className="font-medium mb-3">Order Summary</h2>
        {items.map((item) => (
          <div
            key={`${item.productId}-${item.variantKey}`}
            className="flex justify-between text-sm py-1"
          >
            <span>
              {item.title} x{item.quantity}
            </span>
            <span>${((item.priceCents * item.quantity) / 100).toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t mt-2 pt-2 flex justify-between text-sm">
          <span>Subtotal</span>
          <span>${(subtotalCents / 100).toFixed(2)}</span>
        </div>
        {shippingCents !== null && (
          <div className="flex justify-between text-sm">
            <span>Shipping</span>
            <span>
              {shippingCents === 0
                ? "Free"
                : `$${(shippingCents / 100).toFixed(2)}`}
            </span>
          </div>
        )}
        {shippingCents !== null && (
          <div className="flex justify-between font-medium mt-1">
            <span>Total</span>
            <span>
              ${((subtotalCents + shippingCents) / 100).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <h2 className="font-medium">Contact</h2>
        <input
          name="email"
          type="email"
          placeholder="Email address"
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>

      {/* Shipping Address */}
      <div className="space-y-3">
        <h2 className="font-medium">Shipping Address</h2>
        <input
          name="name"
          placeholder="Full name"
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="address1"
          placeholder="Address line 1"
          required
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <input
          name="address2"
          placeholder="Address line 2 (optional)"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            name="city"
            placeholder="City"
            required
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            name="state_code"
            placeholder="State"
            required
            maxLength={2}
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            name="zip"
            placeholder="ZIP code"
            required
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {shippingCents === null ? (
        <button
          type="button"
          onClick={() => {
            const form = document.querySelector("form");
            if (form) {
              const formData = new FormData(form);
              fetchShipping(formData);
            }
          }}
          disabled={shippingLoading}
          className="w-full rounded-md bg-muted px-4 py-2 text-sm font-medium hover:bg-muted/80"
        >
          {shippingLoading ? "Calculating shipping..." : "Calculate Shipping"}
        </button>
      ) : (
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending ? "Processing..." : "Continue to Payment"}
        </button>
      )}
    </form>
  );
}
