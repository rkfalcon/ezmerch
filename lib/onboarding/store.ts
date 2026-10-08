import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { activeStoreId } from "@/lib/active-store";
export async function onboardingStore() {
  const user = await getUser();
  if (!user) throw new Error("Sign in to continue.");
  const db = createAdminClient();
  const { data: stores, error } = await db
    .from("stores")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at");
  if (error) throw error;
  const id = await activeStoreId(stores ?? []);
  const store = stores?.find((s) => s.id === id) ?? null;
  return { user, db, store };
}
