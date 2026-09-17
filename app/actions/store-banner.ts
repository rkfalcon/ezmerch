"use server";

import { lineupStoreAccess } from "@/lib/lineup/access";
import {
  validateBannerSettings,
  validateHeaderColors,
} from "@/lib/store-banner";
import { revalidatePath } from "next/cache";

export async function updateStoreBanner(storeId: string, formData: FormData) {
  try {
    const { db, store } = await lineupStoreAccess(storeId);
    const settings = validateBannerSettings(
      formData.get("bannerColor"),
      formData.get("bannerSubtitle"),
    );
    const headerSettings = formData.has("headerColor")
      ? validateHeaderColors(
          formData.get("headerColor"),
          formData.get("headerTextColor"),
          formData.get("automaticBannerText") === "on"
            ? null
            : formData.get("bannerTextColor"),
        )
      : {};
    const { error } = await db
      .from("stores")
      .update({ ...settings, ...headerSettings })
      .eq("id", store.id)
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath(`/dashboard/admin/stores/${store.id}`);
    revalidatePath("/dashboard/store/settings");
    revalidatePath("/");
    revalidatePath(`/${store.slug}`, "layout");
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not save the banner",
    };
  }
}
