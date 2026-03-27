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

  // Try reading roles via RLS
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role, store_id")
    .eq("user_id", user.id);

  // If RLS query succeeded and returned results, use them
  if (!error && roles && roles.length > 0) {
    return {
      ...user,
      roles,
      isAdmin: roles.some((r) => r.role === "admin"),
      isStoreOwner: roles.some((r) => r.role === "store_owner"),
      storeId: roles.find((r) => r.role === "store_owner")?.store_id ?? null,
    };
  }

  // Fallback: check JWT claims from the custom access token hook
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const jwtRole = (session?.access_token
    ? JSON.parse(atob(session.access_token.split(".")[1]))
    : {}
  ).user_role;

  return {
    ...user,
    roles: jwtRole ? [{ role: jwtRole, store_id: null }] : [],
    isAdmin: jwtRole === "admin",
    isStoreOwner: jwtRole === "store_owner",
    storeId: null,
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
