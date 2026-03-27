"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserWithRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createProduct(formData: FormData) {
  const user = await getUserWithRole();
  if (!user || (!user.isAdmin && !user.isStoreOwner)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const storeId = formData.get("storeId") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const variantsJson = formData.get("variants") as string;
  const designFileUrl = formData.get("designFileUrl") as string;
  const printfulSyncProductId = formData.get("printfulSyncProductId");

  // Verify store ownership for non-admins
  if (!user.isAdmin) {
    const { data: store } = await supabase
      .from("stores")
      .select("owner_id")
      .eq("id", storeId)
      .single();

    if (!store || store.owner_id !== user.id) {
      return { error: "You don't have access to this store" };
    }
  }

  const variants = variantsJson ? JSON.parse(variantsJson) : [];

  const { data, error } = await supabase
    .from("products")
    .insert({
      store_id: storeId,
      title,
      description,
      variants,
      thumbnail_url: designFileUrl || null,
      printful_sync_product_id: printfulSyncProductId
        ? parseInt(printfulSyncProductId as string, 10)
        : null,
      published: false,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/dashboard/admin/stores/${storeId}`);
  revalidatePath("/dashboard/store/products");
  return { data };
}

export async function updateProduct(productId: string, formData: FormData) {
  const user = await getUserWithRole();
  if (!user || (!user.isAdmin && !user.isStoreOwner)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const variantsJson = formData.get("variants") as string;
  const published = formData.get("published") === "true";

  // Verify ownership for non-admins
  if (!user.isAdmin) {
    const { data: product } = await supabase
      .from("products")
      .select("store_id, stores!inner(owner_id)")
      .eq("id", productId)
      .single();

    if (!product) {
      return { error: "Product not found" };
    }
  }

  const updates: Record<string, unknown> = { title, description, published };
  if (variantsJson) {
    updates.variants = JSON.parse(variantsJson);
  }

  const { error } = await supabase
    .from("products")
    .update(updates)
    .eq("id", productId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/stores");
  revalidatePath("/dashboard/store/products");
  return { success: true };
}

export async function toggleProductPublished(productId: string, published: boolean) {
  const user = await getUserWithRole();
  if (!user || (!user.isAdmin && !user.isStoreOwner)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .update({ published })
    .eq("id", productId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/stores");
  revalidatePath("/dashboard/store/products");
  return { success: true };
}

export async function deleteProduct(productId: string) {
  const user = await getUserWithRole();
  if (!user || (!user.isAdmin && !user.isStoreOwner)) {
    return { error: "Unauthorized" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/stores");
  revalidatePath("/dashboard/store/products");
  return { success: true };
}
