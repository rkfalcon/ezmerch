"use server";

import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function claimStore(token: string) {
  const user = await getUser();

  if (!user) {
    return { error: "You must be logged in to claim a store" };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("claim_store", {
    p_token: token,
    p_user_id: user.id,
  });

  if (error) {
    if (error.message.includes("Invalid or expired")) {
      return { error: "This claim link is invalid or has expired. Please contact the admin for a new link." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { storeId: data };
}
