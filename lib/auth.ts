import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getUserWithRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role, store_id")
    .eq("user_id", user.id);

  return {
    ...user,
    roles: roles ?? [],
    isAdmin: roles?.some((r) => r.role === "admin") ?? false,
    isStoreOwner: roles?.some((r) => r.role === "store_owner") ?? false,
    storeId: roles?.find((r) => r.role === "store_owner")?.store_id ?? null,
  };
}

export async function requireAuth() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  const user = await getUserWithRole();
  if (!user) {
    redirect("/login");
  }
  if (!user.isAdmin) {
    redirect("/dashboard");
  }
  return user;
}

export async function requireStoreOwner() {
  const user = await getUserWithRole();
  if (!user) {
    redirect("/login");
  }
  if (!user.isStoreOwner) {
    redirect("/dashboard");
  }
  return user;
}
