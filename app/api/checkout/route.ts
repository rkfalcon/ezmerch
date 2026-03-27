import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { calculateRevenueSplit } from "@/lib/revenue";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const {
    storeId,
    items,
    shippingAddress,
    customerEmail,
    shippingCents,
    taxCents,
  } = await request.json();

  if (!storeId || !items?.length || !shippingAddress || !customerEmail) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch store for revenue split
  const { data: store } = await supabase
    .from("stores")
    .select("id, claimed, stripe_account_id")
    .eq("id", storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // Server-side cart validation — look up actual prices from DB
  const productIds = [...new Set(items.map((i: { productId: string }) => i.productId))];
  const { data: products } = await supabase
    .from("products")
    .select("id, store_id, variants, published")
    .in("id", productIds)
    .eq("published", true);

  if (!products || products.length !== productIds.length) {
    return NextResponse.json(
      { error: "Some products are no longer available" },
      { status: 400 }
    );
  }

  // Validate all products belong to this store and compute subtotal from server prices
  let subtotalCents = 0;
  const validatedItems: Array<{
    productId: string;
    variantKey: string;
    quantity: number;
    priceCents: number;
  }> = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.store_id !== storeId) {
      return NextResponse.json(
        { error: `Product ${item.productId} does not belong to this store` },
        { status: 400 }
      );
    }

    const variants =
      typeof product.variants === "string"
        ? JSON.parse(product.variants)
        : product.variants;

    const variant = variants.find(
      (v: { variant_id: number }) => `${v.variant_id}` === item.variantKey
    );

    if (!variant) {
      return NextResponse.json(
        { error: `Invalid variant ${item.variantKey}` },
        { status: 400 }
      );
    }

    const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
    subtotalCents += priceCents * item.quantity;

    validatedItems.push({
      productId: item.productId,
      variantKey: item.variantKey,
      quantity: item.quantity,
      priceCents,
    });
  }

  const finalShippingCents = shippingCents || 0;
  const finalTaxCents = taxCents || 0;
  const totalCents = subtotalCents + finalShippingCents + finalTaxCents;

  // Calculate revenue split on subtotal only
  const split = calculateRevenueSplit(store, subtotalCents);

  // Build PaymentIntent params
  const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
    amount: totalCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      store_id: storeId,
      customer_email: customerEmail,
      items: JSON.stringify(
        validatedItems.map((i) => ({
          productId: i.productId,
          variantKey: i.variantKey,
          quantity: i.quantity,
          priceCents: i.priceCents,
        }))
      ),
      shipping_address: JSON.stringify(shippingAddress),
      subtotal_cents: subtotalCents.toString(),
      shipping_cents: finalShippingCents.toString(),
      tax_cents: finalTaxCents.toString(),
      platform_fee_cents: split.platformKeepsAll
        ? subtotalCents.toString()
        : split.applicationFeeCents.toString(),
    },
  };

  // Add Stripe Connect transfer for claimed stores
  if (!split.platformKeepsAll && split.destinationAccountId) {
    paymentIntentParams.application_fee_amount = split.applicationFeeCents;
    paymentIntentParams.transfer_data = {
      destination: split.destinationAccountId,
    };
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create(
      paymentIntentParams
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subtotalCents,
      shippingCents: finalShippingCents,
      taxCents: finalTaxCents,
      totalCents,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
