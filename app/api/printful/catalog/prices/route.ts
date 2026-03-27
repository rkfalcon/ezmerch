import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCatalogProduct } from "@/lib/printful";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productIds } = await request.json();

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return NextResponse.json({ error: "productIds required" }, { status: 400 });
  }

  // Fetch in parallel batches of 10 to respect rate limits
  const prices: Record<number, { min: number; max: number }> = {};
  const batchSize = 10;

  for (let i = 0; i < productIds.length; i += batchSize) {
    const batch = productIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((id: number) => getCatalogProduct(id))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const productId = batch[j];
      if (result.status === "fulfilled" && result.value.variants) {
        const variantPrices = result.value.variants
          .filter((v) => v.in_stock)
          .map((v) => parseFloat(v.price))
          .filter((p) => !isNaN(p) && p > 0);

        if (variantPrices.length > 0) {
          prices[productId] = {
            min: Math.min(...variantPrices),
            max: Math.max(...variantPrices),
          };
        }
      }
    }
  }

  return NextResponse.json(prices);
}
