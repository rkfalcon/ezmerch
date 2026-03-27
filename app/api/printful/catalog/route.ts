import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { getCatalogProducts, getCatalogProduct } from "@/lib/printful";

export async function GET(request: Request) {
  // Require authentication
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");

  try {
    if (productId) {
      const data = await getCatalogProduct(parseInt(productId, 10));
      return NextResponse.json(data);
    }

    const products = await getCatalogProducts();
    return NextResponse.json(products);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
