import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
export async function onboardingStore() {
  const user = await getUser();
  if (!user) throw new Error("Sign in to continue.");
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return { user, db, store };
}
