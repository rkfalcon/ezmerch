import { createAdminClient } from "../supabase/admin";

export async function deliverLineupEmails(limit = 5) {
  // Keep queued notifications untouched while email delivery is deferred.
  if (process.env.LINEUP_EMAIL_ENABLED !== "true") return { sent: 0 };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!apiKey || !from || !origin)
    throw new Error(
      "Email delivery is enabled but Resend configuration is incomplete",
    );
  const db = createAdminClient();
  let sent = 0;
  for (let index = 0; index < limit; index++) {
    const { data: claims, error: claimError } =
      await db.rpc("claim_lineup_email");
    if (claimError) throw claimError;
    const email = claims?.[0];
    if (!email) break;
    try {
      const { data: notification, error } = await db
        .from("notifications")
        .select("*")
        .eq("id", email.notification_id)
        .single();
      if (error || !notification)
        throw new Error("Notification could not be loaded");
      const { data: user, error: userError } = await db.auth.admin.getUserById(
        notification.recipient_id,
      );
      if (userError || !user.user?.email)
        throw new Error("Recipient has no email address");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `lineup-${notification.id}`,
        },
        body: JSON.stringify({
          from,
          to: [user.user.email],
          subject: notification.title,
          text: `${notification.message}\n\nView details: ${new URL(notification.href, origin).href}`,
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => null);
        const reason = typeof details?.message === "string"
          ? details.message.replaceAll(apiKey, "[redacted]").slice(0, 500)
          : "No provider details available";
        throw new Error(`Email provider returned ${response.status}: ${reason}`);
      }
      const { error: saveError } = await db
        .from("notification_emails")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("notification_id", email.notification_id);
      if (saveError) throw saveError;
      sent++;
    } catch (error) {
      const { error: saveError } = await db
        .from("notification_emails")
        .update({
          status: email.attempts >= 5 ? "failed" : "pending",
          last_error:
            error instanceof Error ? error.message : "Email delivery failed",
          available_at: new Date(
            Date.now() + Math.min(3600_000, 60_000 * 2 ** email.attempts),
          ).toISOString(),
        })
        .eq("notification_id", email.notification_id);
      if (saveError) throw saveError;
    }
  }
  return { sent };
}
