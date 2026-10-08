"use server";
import { siteOrigin } from "@/lib/site";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateClaimToken } from "@/lib/claim-token";
import {
  renderInvitation,
  validateInvitationTemplate,
  type InvitationTemplate,
} from "@/lib/invitations/email";
import {
  deliverInvitation,
  hashInvitationToken,
  invitationStore,
} from "@/lib/invitations/server";
import { revalidatePath } from "next/cache";

export async function saveInvitationTemplate(template: InvitationTemplate) {
  await requireAdmin();
  const error = validateInvitationTemplate(template);
  if (error) return { error };
  const { error: dbError } = await createAdminClient()
    .from("store_invitation_template")
    .upsert({ id: true, ...template, updated_at: new Date().toISOString() });
  if (dbError) return { error: "Could not save the invitation template." };
  revalidatePath("/dashboard/admin/invitations");
  revalidatePath("/dashboard/admin/emails");
  return { success: true };
}
export async function sendStoreInvitation(
  storeId: string,
  email: string,
  template: InvitationTemplate,
) {
  const admin = await requireAdmin();
  const recipient = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254)
    return { error: "Enter a valid recipient email address." };
  const error = validateInvitationTemplate(template);
  if (error) return { error };
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!from || !process.env.RESEND_API_KEY)
    return {
      error: "Email sending is not configured. Check the Resend settings.",
    };
  const token = generateClaimToken();
  const origin =
    siteOrigin;
  try {
    const store = await invitationStore(storeId);
    const message = renderInvitation(
      template,
      store,
      origin,
      `${origin}/claim/${token}`,
    );
    const { data: id, error: issueError } = await createAdminClient().rpc(
      "issue_store_invitation",
      {
        p_store_id: storeId,
        p_email: recipient,
        p_hash: hashInvitationToken(token),
        p_creator: admin.id,
        p_payload: { from, to: [recipient], ...message },
      },
    );
    if (issueError) return { error: issueError.message };
    // The persisted snapshot is retried without changing its idempotency key.
    let sent = false;
    try {
      sent = (await deliverInvitation(id)).sent;
    } catch {
      /* Cron retries persisted invitations. */
    }
    revalidatePath(`/dashboard/admin/stores/${storeId}`);
    return {
      success: true,
      message: sent
        ? "Invitation sent. Resend accepted the email."
        : "Invitation queued. Delivery will retry automatically; refresh to check its status.",
    };
  } catch {
    return { error: "Could not create the invitation. Please try again." };
  }
}
export async function revokeStoreInvitation(id: string, storeId: string) {
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("store_invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("store_id", storeId)
    .is("accepted_at", null);
  if (error) return { error: "Could not revoke the invitation." };
  revalidatePath(`/dashboard/admin/stores/${storeId}`);
  return { success: true };
}
