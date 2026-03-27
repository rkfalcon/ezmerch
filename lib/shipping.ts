import { getShippingRates } from "./printful";

interface ShippingAddress {
  address1: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
}

interface CartItem {
  printful_variant_id: number;
  quantity: number;
}

interface StoreShippingPolicy {
  shipping_policy: "passthrough" | "free" | "flat_discount";
  shipping_discount_cents: number | null;
}

export async function calculateShipping(
  address: ShippingAddress,
  items: CartItem[],
  storePolicy: StoreShippingPolicy
): Promise<{ shippingCents: number; shippingName: string }> {
  // Free shipping — store covers all costs
  if (storePolicy.shipping_policy === "free") {
    return { shippingCents: 0, shippingName: "Free Shipping" };
  }

  // Fetch rates from Printful
  const rates = await getShippingRates({
    recipient: address,
    items: items.map((i) => ({
      variant_id: i.printful_variant_id,
      quantity: i.quantity,
    })),
  });

  if (!rates || rates.length === 0) {
    throw new Error("No shipping rates available for this address");
  }

  // Use the first (cheapest/standard) rate
  const rate = rates[0];
  let shippingCents = Math.round(parseFloat(rate.rate) * 100);

  // Apply flat discount if applicable
  if (storePolicy.shipping_policy === "flat_discount" && storePolicy.shipping_discount_cents) {
    shippingCents = Math.max(0, shippingCents - storePolicy.shipping_discount_cents);
  }

  return {
    shippingCents,
    shippingName: rate.name,
  };
}
