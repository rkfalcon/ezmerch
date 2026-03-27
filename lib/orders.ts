import { createClient } from "@supabase/supabase-js";
import { createOrder, confirmOrder } from "./printful";
import type { PrintfulRecipient } from "./printful-types";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface OrderData {
  storeId: string;
  customerId: string | null;
  customerEmail: string;
  stripePaymentIntentId: string;
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  platformFeeCents: number;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
  };
  items: Array<{
    productId: string;
    variantKey: string;
    quantity: number;
    priceCents: number;
    printfulSyncVariantId: number;
  }>;
}

export async function createOrderFromPayment(data: OrderData) {
  const supabase = getAdminClient();

  // Create order in Supabase
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      store_id: data.storeId,
      customer_id: data.customerId,
      customer_email: data.customerEmail,
      stripe_payment_intent_id: data.stripePaymentIntentId,
      status: "paid",
      subtotal_cents: data.subtotalCents,
      shipping_cents: data.shippingCents,
      tax_cents: data.taxCents,
      total_cents: data.totalCents,
      platform_fee_cents: data.platformFeeCents,
      shipping_address: data.shippingAddress,
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(`Failed to create order: ${orderError?.message}`);
  }

  // Create order items
  const orderItems = data.items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    variant_key: item.variantKey,
    quantity: item.quantity,
    price_cents: item.priceCents,
  }));

  await supabase.from("order_items").insert(orderItems);

  // Trigger Printful fulfillment
  await triggerPrintfulFulfillment(order.id, data);

  return order;
}

async function triggerPrintfulFulfillment(orderId: string, data: OrderData) {
  const supabase = getAdminClient();

  const recipient: PrintfulRecipient = {
    name: data.shippingAddress.name,
    address1: data.shippingAddress.address1,
    address2: data.shippingAddress.address2,
    city: data.shippingAddress.city,
    state_code: data.shippingAddress.state_code,
    country_code: data.shippingAddress.country_code,
    zip: data.shippingAddress.zip,
    email: data.customerEmail,
  };

  try {
    // Create draft order in Printful
    const printfulOrder = await createOrder({
      external_id: orderId,
      recipient,
      items: data.items.map((item) => ({
        sync_variant_id: item.printfulSyncVariantId,
        quantity: item.quantity,
      })),
    });

    // Confirm the order (Printful charges at this point)
    await confirmOrder(printfulOrder.id);

    // Update order with Printful ID and status
    await supabase
      .from("orders")
      .update({
        printful_order_id: printfulOrder.id,
        status: "fulfilling",
      })
      .eq("id", orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Printful order failed";

    // Update order with failure info
    await supabase
      .from("orders")
      .update({
        status: "fulfillment_failed",
        printful_error: message,
        retry_count: 1,
      })
      .eq("id", orderId);

    console.error(`Printful fulfillment failed for order ${orderId}:`, message);
  }
}

export async function retryFulfillment(orderId: string) {
  const supabase = getAdminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("id", orderId)
    .single();

  if (!order || order.status !== "fulfillment_failed") {
    throw new Error("Order not eligible for retry");
  }

  if (order.retry_count >= 3) {
    throw new Error("Maximum retry attempts reached");
  }

  // Increment retry count
  await supabase
    .from("orders")
    .update({ retry_count: order.retry_count + 1 })
    .eq("id", orderId);

  // Re-fetch product data for sync variant IDs
  const productIds = [...new Set(order.order_items.map((i: { product_id: string }) => i.product_id))];
  const { data: products } = await supabase
    .from("products")
    .select("id, variants")
    .in("id", productIds);

  const productVariantMap = new Map<string, number>();
  products?.forEach((p: { id: string; variants: Array<{ variant_id: number }> | string }) => {
    const variants = typeof p.variants === "string" ? JSON.parse(p.variants) : p.variants;
    variants.forEach((v: { variant_id: number }) => {
      productVariantMap.set(`${p.id}-${v.variant_id}`, v.variant_id);
    });
  });

  const items = order.order_items.map((item: { product_id: string; variant_key: string; quantity: number; price_cents: number }) => ({
    productId: item.product_id,
    variantKey: item.variant_key,
    quantity: item.quantity,
    priceCents: item.price_cents,
    printfulSyncVariantId: parseInt(item.variant_key, 10),
  }));

  await triggerPrintfulFulfillment(orderId, {
    ...order,
    storeId: order.store_id,
    customerId: order.customer_id,
    customerEmail: order.customer_email,
    stripePaymentIntentId: order.stripe_payment_intent_id,
    subtotalCents: order.subtotal_cents,
    shippingCents: order.shipping_cents,
    taxCents: order.tax_cents,
    totalCents: order.total_cents,
    platformFeeCents: order.platform_fee_cents,
    shippingAddress: order.shipping_address,
    items,
  });
}
