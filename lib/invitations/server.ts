import { deliverQueuedEmail } from "@/lib/email/delivery";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  defaultInvitationTemplate,
  toInvitationStore,
  type InvitationStore,
} from "./email";
export const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function invitationTemplate() {
  const { data, error } = await createAdminClient()
    .from("store_invitation_template")
    .select("subject,body")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? defaultInvitationTemplate;
}
export async function invitationStore(
  storeId: string,
): Promise<InvitationStore> {
  const db = createAdminClient();
  const [{ data: store, error }, { data: products, error: productError }] =
    await Promise.all([
      db
        .from("stores")
        .select("name,slug,logo_url,brand_colors")
        .eq("id", storeId)
        .single(),
      db
        .from("products")
        .select(
          "title,thumbnail_url,variants,default_color,enabled_colors,global_enabled_colors",
        )
        .eq("store_id", storeId)
        .order("created_at"),
    ]);
  if (error || productError) throw error || productError;
  return toInvitationStore(store, products ?? []);
}
export async function deliverInvitation(id?: string, db = createAdminClient(), send = fetch) {
  return deliverQueuedEmail("invitation", id, db, send);
}
