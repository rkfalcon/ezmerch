"use server";

import { createClient } from "@/lib/supabase/server";
import { requireStoreOwner } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateStoreSettings(formData: FormData) {
  const user = await requireStoreOwner();
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const primaryColor = (formData.get("primaryColor") as string) || "#000000";
  const accentColor = (formData.get("accentColor") as string) || "#3b82f6";
  const shippingPolicy = (formData.get("shippingPolicy") as string) || "passthrough";
  const shippingDiscountCents = formData.get("shippingDiscountCents")
    ? parseInt(formData.get("shippingDiscountCents") as string, 10)
    : null;

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      brand_colors: { primary: primaryColor, accent: accentColor },
      shipping_policy: shippingPolicy,
      shipping_discount_cents: shippingDiscountCents,
    })
    .eq("id", user.storeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/store/settings");
  revalidatePath(`/${formData.get("slug")}`);
  return { success: true };
}
