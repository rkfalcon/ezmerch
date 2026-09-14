import { getUserWithRole } from "../auth";
import { createAdminClient } from "../supabase/admin";

export async function lineupAdmin() {
  const user = await getUserWithRole();
  if (!user?.isAdmin) throw new Error("Admin access required");
  return user;
}
export async function lineupStoreAccess(storeId: string) {
  const user = await getUserWithRole();
  if (!user) throw new Error("Sign in required");
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("id,name,slug,owner_id,lineup_logo_path,logo_url")
    .eq("id", storeId)
    .single();
  if (error || !store || (!user.isAdmin && store.owner_id !== user.id))
    throw new Error("Store access denied");
  return { user, store, db };
}
