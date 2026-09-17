import { unstable_cache } from "next/cache";
import { lineupAdmin } from "@/lib/lineup/access";
import { PrintfulClient, PrintfulError } from "@/lib/lineup/printful";
import { startingCost, fastestRate, type CatalogInsight } from "@/lib/lineup/catalog-insights";

// Read-only quotes, cached for this Printful store and destination. No order is created.
const productInfo = unstable_cache(async (id: number, store: string) => {
  void store;
  return new PrintfulClient().product(id);
}, ["catalog-price-v1"], { revalidate: 3600 });
const deliveryInfo = unstable_cache(async (variantId: number, store: string) => {
  void store;
  return new PrintfulClient().request<{ minDeliveryDate?: string; maxDeliveryDate?: string }[]>("/shipping/rates", {
    recipient: { country_code: "US", state_code: "NJ", zip: "07751" },
    items: [{ variant_id: variantId, quantity: 1 }], currency: "USD",
  });
}, ["catalog-delivery-US-NJ-07751-v1"], { revalidate: 900 });

export async function POST(request: Request) {
  try { await lineupAdmin(); } catch { return Response.json({ error: "Admin access required" }, { status: 403 }); }
  let ids: number[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.productIds) || !body.productIds.length || body.productIds.length > 4 || body.productIds.some((id: unknown) => !Number.isSafeInteger(id) || Number(id) <= 0)) throw new Error();
    ids = [...new Set(body.productIds)] as number[];
  } catch { return Response.json({ error: "Provide one to four product IDs." }, { status: 400 }); }
  const results: Record<number, CatalogInsight> = {};
  let limited = false;
  await Promise.all(ids.map(async (id) => {
    try {
      const store = process.env.PRINTFUL_STORE_ID ?? "";
      const { product, variants } = await productInfo(id, store);
      const price = startingCost(variants);
      const entry: CatalogInsight = { price, currency: (product as typeof product & { currency?: string }).currency ?? "USD", delivery: null };
      results[id] = entry;
      const variant = variants.find((v) => v.in_stock && Number(v.price) === price);
      if (variant) {
        const best = fastestRate(await deliveryInfo(variant.id, store));
        if (best) entry.delivery = { minDate: best.minDeliveryDate!, maxDate: best.maxDeliveryDate!, variant: variant.name };
      }
    } catch (error) {
      if (error instanceof PrintfulError && error.status === 429) limited = true;
      // Preserve a price even if a delivery estimate could not be retrieved.
      results[id] ??= { price: null, currency: "USD", delivery: null };
    }
  }));
  return Response.json({ products: results, limited });
}
