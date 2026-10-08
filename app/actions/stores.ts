"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { validateSlug } from "@/lib/reserved-slugs";
import { revalidatePath } from "next/cache";

export async function createStore(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const slug = (formData.get("slug") as string).toLowerCase().trim();
  const primaryColor = (formData.get("primaryColor") as string) || "#000000";
  const accentColor = (formData.get("accentColor") as string) || "#3b82f6";
  const shippingPolicy =
    (formData.get("shippingPolicy") as string) || "passthrough";
  const shippingDiscountCents = formData.get("shippingDiscountCents")
    ? parseInt(formData.get("shippingDiscountCents") as string, 10)
    : null;

  // Validate slug
  const slugValidation = validateSlug(slug);
  if (!slugValidation.valid) {
    return { error: slugValidation.error };
  }

  // Check slug uniqueness
  const { data: existing } = await supabase
    .from("stores")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return { error: "A store with this slug already exists" };
  }

  const { data, error } = await supabase
    .from("stores")
    .insert({
      name,
      show_on_homepage: formData.get("showOnHomepage") === "on",
      slug,
      brand_colors: { primary: primaryColor, accent: accentColor },
      shipping_policy: shippingPolicy,
      shipping_discount_cents: shippingDiscountCents,
    })
    .select()
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/dashboard/admin/stores");
  return { data };
}

export async function updateStore(storeId: string, formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const primaryColor = (formData.get("primaryColor") as string) || "#000000";
  const accentColor = (formData.get("accentColor") as string) || "#3b82f6";
  const shippingPolicy =
    (formData.get("shippingPolicy") as string) || "passthrough";
  const shippingDiscountCents = formData.get("shippingDiscountCents")
    ? parseInt(formData.get("shippingDiscountCents") as string, 10)
    : null;

  const { error } = await supabase
    .from("stores")
    .update({
      name,
      show_on_homepage: formData.get("showOnHomepage") === "on",
      brand_colors: { primary: primaryColor, accent: accentColor },
      shipping_policy: shippingPolicy,
      shipping_discount_cents: shippingDiscountCents,
    })
    .eq("id", storeId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/dashboard/admin/stores");
  revalidatePath(`/dashboard/admin/stores/${storeId}`);
  return { success: true };
}
