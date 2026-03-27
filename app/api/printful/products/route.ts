import { NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth";
import { createSyncProduct } from "@/lib/printful";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getUserWithRole();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admins and store owners can create products
  if (!user.isAdmin && !user.isStoreOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { storeId, title, description, variants, designFileUrl } = body;

  // If store owner, verify they own the store
  if (!user.isAdmin) {
    const supabase = await createClient();
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", storeId)
      .single();

    if (!store || store.owner_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    // Create sync product in Printful
    const syncProduct = await createSyncProduct({
      sync_product: { name: title },
      sync_variants: variants.map(
        (v: { variant_id: number; retail_price: string }) => ({
          variant_id: v.variant_id,
          retail_price: v.retail_price,
          files: [{ url: designFileUrl, type: "default" }],
        })
      ),
    });

    // Save product in Supabase
    const supabase = await createClient();
    const { data: product, error } = await supabase
      .from("products")
      .insert({
        store_id: storeId,
        printful_sync_product_id: syncProduct.id,
        title,
        description,
        variants: JSON.stringify(variants),
        thumbnail_url: syncProduct.thumbnail_url,
        published: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(product);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create product";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
