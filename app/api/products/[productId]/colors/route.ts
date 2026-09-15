import { getUserWithRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateColorSelection,
  type ColorVariant,
} from "@/lib/product-colors";
import { revalidatePath } from "next/cache";

async function accessibleProduct(productId: string) {
  const user = await getUserWithRole();
  if (!user) return null;
  const db = createAdminClient();
  const { data: product, error } = await db
    .from("products")
    .select("id,title,thumbnail_url,variants,enabled_colors,store_id")
    .eq("id", productId)
    .single();
  if (error || !product) return null;
  const { data: store } = await db
    .from("stores")
    .select("id,slug,owner_id")
    .eq("id", product.store_id)
    .single();
  if (!store || (!user.isAdmin && store.owner_id !== user.id)) return null;
  const variants: ColorVariant[] =
    typeof product.variants === "string"
      ? JSON.parse(product.variants)
      : product.variants;
  if (!Array.isArray(variants))
    throw new Error("Product variants are unavailable");
  return { db, store, product: { ...product, variants } };
}

type Context = { params: Promise<{ productId: string }> };
export async function GET(_request: Request, context: Context) {
  const result = await accessibleProduct((await context.params).productId);
  if (!result)
    return Response.json(
      { error: "Product not found or access denied" },
      { status: 403 },
    );
  return Response.json(result.product, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function PATCH(request: Request, context: Context) {
  const result = await accessibleProduct((await context.params).productId);
  if (!result)
    return Response.json(
      { error: "Product not found or access denied" },
      { status: 403 },
    );
  try {
    const colors = validateColorSelection(
      result.product.variants,
      (await request.json()).colors,
    );
    const { error } = await result.db
      .from("products")
      .update({ enabled_colors: colors })
      .eq("id", result.product.id)
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/dashboard/admin/stores/${result.store.id}`);
    revalidatePath(`/dashboard/admin/stores/${result.store.id}/products`);
    revalidatePath("/dashboard/store/products");
    revalidatePath(`/${result.store.slug}`, "layout");
    return Response.json({ colors });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Colors could not be saved",
      },
      { status: 400 },
    );
  }
}
