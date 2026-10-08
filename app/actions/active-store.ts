"use server";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
export async function selectActiveStore(form: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const id = String(form.get("storeId") ?? "");
  const { data, error } = await createAdminClient()
    .from("stores")
    .select("id")
    .eq("owner_id", user.id)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Store unavailable.");
  (await cookies()).set("ezmerch_active_store", id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/dashboard/store");
}
