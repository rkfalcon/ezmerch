import { PrintfulClient } from "@/lib/lineup/printful";
import { stripeReady } from "@/lib/onboarding/validation";
import { NextResponse } from "next/server";
import { enabledVariants, type ColorVariant } from "@/lib/product-colors";
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
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // Fetch store for revenue split
  const { data: store } = await supabase
    .from("stores")
    .select(
      "id, claimed, stripe_account_id, selling_enabled, onboarding_started_at",
    )
    .eq("id", storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  if (!store.selling_enabled)
    return NextResponse.json(
      { error: "This store is getting ready to open. Please check back soon." },
      { status: 409 },
    );
  if (store.onboarding_started_at) {
    if (!store.stripe_account_id)
      return NextResponse.json(
        { error: "This store is not ready to accept payments." },
        { status: 409 },
      );
    try {
      const account = await stripe.accounts.retrieve(store.stripe_account_id);
      if (!stripeReady(account))
        return NextResponse.json(
          { error: "This store is not ready to accept payments." },
          { status: 409 },
        );
    } catch {
      return NextResponse.json(
        { error: "Unable to verify payment availability. Please try again." },
        { status: 503 },
      );
    }
  }

  // Server-side cart validation — look up actual prices from DB
  const productIds = [
    ...new Set(items.map((i: { productId: string }) => i.productId)),
  ];
  const { data: products } = await supabase
    .from("products")
    .select(
      "id, store_id, variants, published, enabled_colors, global_enabled_colors, template_id",
    )
    .in("id", productIds)
    .eq("published", true)
    .eq("global_active", true);

  if (!products || products.length !== productIds.length) {
    return NextResponse.json(
      { error: "Some products are no longer available" },
      { status: 400 },
    );
  }

  // Validate all products belong to this store and compute subtotal from server prices
  let subtotalCents = 0;
  const validatedItems: Array<{
    productId: string;
    variantKey: string;
    quantity: number;
    priceCents: number;
    printfulSyncVariantId: number;
  }> = [];

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || product.store_id !== storeId) {
      return NextResponse.json(
        { error: `Product ${item.productId} does not belong to this store` },
        { status: 400 },
      );
    }

    const allVariants: ColorVariant[] =
      typeof product.variants === "string"
        ? JSON.parse(product.variants)
        : product.variants;

    const variant = enabledVariants(
      allVariants,
      product.enabled_colors,
      product.global_enabled_colors,
    ).find(
      (v: { variant_id: number }) => `${v.variant_id}` === item.variantKey,
    );

    if (!variant) {
      return NextResponse.json(
        { error: `Invalid variant ${item.variantKey}` },
        { status: 400 },
      );
    }

    const priceCents = Math.round(parseFloat(variant.retail_price) * 100);
    subtotalCents += priceCents * item.quantity;

    validatedItems.push({
      productId: item.productId,
      variantKey: item.variantKey,
      quantity: item.quantity,
      priceCents,
      printfulSyncVariantId: variant.sync_variant_id ?? variant.variant_id,
    });
  }

  if (shippingAddress.country_code && shippingAddress.country_code !== "US")
    return NextResponse.json(
      { error: "Checkout currently supports US delivery only." },
      { status: 400 },
    );
  // Verify the exact catalog variant immediately before creating a payment.
  try {
    const client = new PrintfulClient();
    const templateIds = products.map((p) => p.template_id).filter(Boolean);
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { data: templates, error: templateError } = templateIds.length
      ? await createAdminClient()
          .from("product_templates")
          .select("id,technique")
          .in("id", templateIds)
      : { data: [], error: null };
    if (templateError) throw templateError;
    for (const item of validatedItems) {
      const result = await client.request<{
        variant: { in_stock: boolean };
        product: {
          is_discontinued: boolean;
          techniques?: { key: string; is_default: boolean }[];
        };
      }>(`/products/variant/${Number(item.variantKey)}`);
      if (
        result?.variant?.in_stock !== true ||
        result?.product?.is_discontinued
      )
        return NextResponse.json(
          {
            error:
              "An item in your cart is out of stock. Please choose another size or color.",
          },
          { status: 409 },
        );
      const product = products.find((p) => p.id === item.productId)!;
      const template = templates?.find((t) => t.id === product.template_id);
      const technique =
        template?.technique === "embroidery"
          ? "embroidery"
          : result.product.techniques
              ?.find((t) => t.is_default)
              ?.key.toLowerCase();
      if (!technique) throw new Error("Missing technique");
      const availability = await client.request<
        import("@/lib/lineup/availability").StockRow
      >(`/v2/catalog-variants/${Number(item.variantKey)}/availability`);
      const { availableInUSA } = await import("@/lib/lineup/availability");
      if (!availableInUSA(availability, technique))
        return NextResponse.json(
          {
            error:
              "An item is unavailable for US delivery in the selected size or color. Please update your cart.",
          },
          { status: 409 },
        );
    }
  } catch {
    return NextResponse.json(
      {
        error:
          "We couldn't confirm product availability. Please try again shortly. You have not been charged.",
      },
      { status: 503 },
    );
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
          printfulSyncVariantId: i.printfulSyncVariantId,
        })),
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
    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentParams);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      subtotalCents,
      shippingCents: finalShippingCents,
      taxCents: finalTaxCents,
      totalCents,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Payment creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
