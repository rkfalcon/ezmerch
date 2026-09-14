"use server";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(form: FormData) {
  const user = await requireAuth();
  const db = await createClient();
  const { error } = await db
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", String(form.get("id")))
    .eq("recipient_id", user.id);
  if (error) throw new Error("Could not mark notification as read");
  revalidatePath("/dashboard/notifications");
}
