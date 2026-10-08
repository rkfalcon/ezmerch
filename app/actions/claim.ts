"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { hashInvitationToken } from "@/lib/invitations/server";
import { revalidatePath } from "next/cache";

export async function claimStore(token: string) {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in to claim a store" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("accept_store_invitation", {
    p_hash: hashInvitationToken(token),
  });

  if (error) {
    if (error.message.includes("Invalid or expired")) {
      return {
        error:
          "This claim link is invalid or has expired. Please contact the admin for a new link.",
      };
    }
    return { error: error.message };
  }

  (await cookies()).set("ezmerch_active_store", data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard", "layout");
  return { storeId: data };
}

export async function switchClaimAccount(token: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { redirect } = await import("next/navigation");
  redirect(`/login?next=${encodeURIComponent(`/claim/${token}`)}`);
}
