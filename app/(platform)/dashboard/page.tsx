import { createAdminClient } from "@/lib/supabase/admin";
import { getUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getUserWithRole();

  if (!user) {
    redirect("/login");
  }

  if (user.isAdmin) {
    redirect("/dashboard/admin/stores");
  }

  const { data: store, error } = await createAdminClient()
    .from("stores")
    .select("id,onboarding_started_at,selling_enabled")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!store || (store.onboarding_started_at && !store.selling_enabled))
    redirect("/dashboard/onboarding");
  redirect("/dashboard/store");
}
