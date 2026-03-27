import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateShipping } from "@/lib/shipping";

export async function POST(request: Request) {
  const { storeId, address, items } = await request.json();

  if (!storeId || !address || !items?.length) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Fetch store shipping policy
  const { data: store } = await supabase
    .from("stores")
    .select("shipping_policy, shipping_discount_cents")
    .eq("id", storeId)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  try {
    const shipping = await calculateShipping(address, items, store);
    return NextResponse.json(shipping);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to calculate shipping";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
