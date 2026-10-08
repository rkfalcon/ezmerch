"use server";
import { getUser, requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { developerEmailTemplate } from "@/lib/sharing/server";
import {
  renderDeveloperEmail,
  validateDeveloperTemplate,
  type DeveloperTemplate,
} from "@/lib/sharing/guide";
import { deliverQueuedEmail } from "@/lib/email/delivery";
import { revalidatePath } from "next/cache";
export async function saveDeveloperEmailTemplate(template: DeveloperTemplate) {
  await requireAdmin();
  const error = validateDeveloperTemplate(template);
  if (error) return { error };
  const { error: saveError } = await createAdminClient()
    .from("store_website_email_template")
    .upsert({
      id: true,
      subject: template.subject,
      body: template.body,
      updated_at: new Date().toISOString(),
    });
  if (saveError) return { error: "Could not save the email template." };
  revalidatePath("/dashboard/admin/emails");
  revalidatePath("/dashboard/store/share");
  return { success: true };
}
export async function emailStoreInstructions(
  storeId: string,
  email: string,
  requestId: string,
) {
  const user = await getUser();
  if (!user?.email_confirmed_at)
    return {
      error: "Sign in and verify your email before sending instructions.",
    };
  const recipient = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) || recipient.length > 254)
    return { error: "Enter your developer’s email address." };
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      requestId,
    )
  )
    return { error: "Please refresh the page and try again." };
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("id,name,slug")
    .eq("id", storeId)
    .eq("owner_id", user.id)
    .eq("claimed", true)
    .maybeSingle();
  if (error || !store)
    return { error: "You can only send instructions for your own store." };
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!from || !process.env.RESEND_API_KEY)
    return {
      error:
        "Email sending is temporarily unavailable. You can still copy all instructions below.",
    };
  try {
    const message = renderDeveloperEmail(await developerEmailTemplate(), store);
    const { data: id, error: queueError } = await db.rpc(
      "queue_store_website_email",
      {
        p_id: requestId,
        p_store: store.id,
        p_user: user.id,
        p_email: recipient,
        p_payload: { from, to: [recipient], reply_to: user.email, ...message },
      },
    );
    if (queueError) return { error: queueError.message };
    try {
      await deliverQueuedEmail("website", id);
    } catch {
      /* The durable queue retries automatically. */
    }
    const { data: status } = await db
      .from("store_website_emails")
      .select("email_status")
      .eq("id", id)
      .single();
    revalidatePath("/dashboard/store/share");
    return {
      success: true,
      message:
        status?.email_status === "sent"
          ? "Instructions sent. Our email provider accepted the message."
          : status?.email_status === "failed"
            ? "Email delivery could not be confirmed. Send a new email or copy the instructions."
            : "Instructions queued. Delivery will retry automatically; refresh this page to check the status.",
    };
  } catch {
    return {
      error:
        "Could not send instructions. Try again or use Copy all instructions.",
    };
  }
}
