"use server";
import { getUserWithRole } from "@/lib/auth";
import { applySizePrice } from "@/lib/lineup/size-prices";
import { lineupStoreAccess } from "@/lib/lineup/access";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function setProductPrice(
  productId: string,
  priceCents: number,
  size?: string | number,
) {
  try {
    if (!(await getUserWithRole())) throw new Error("Sign in required");
    if (
      !Number.isInteger(priceCents) ||
      priceCents <= 0 ||
      priceCents > 1000000
    )
      throw new Error("Enter a valid retail price");
    const db = createAdminClient();
    const { data: product, error } = await db
      .from("products")
      .select("store_id,variants")
      .eq("id", productId)
      .single();
    if (error || !product) throw new Error("Product not found");
    const { store } = await lineupStoreAccess(product.store_id);
    const variants =
      typeof product.variants === "string"
        ? JSON.parse(product.variants)
        : product.variants;
    if (!Array.isArray(variants) || !variants.length)
      throw new Error("Product has no variants");
    const updated = applySizePrice(variants, priceCents, size);
    const { error: saveError } = await db
      .from("products")
      .update({ variants: updated })
      .eq("id", productId);
    if (saveError) throw saveError;
    revalidatePath(`/dashboard/admin/stores/${store.id}`);
    revalidatePath(`/dashboard/admin/stores/${store.id}/products`);
    revalidatePath("/dashboard/store/products");
    revalidatePath(`/${store.slug}`, "layout");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Price could not be saved",
    };
  }
}
