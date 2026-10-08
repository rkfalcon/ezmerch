import { createAdminClient } from "@/lib/supabase/admin";
export async function deliverQueuedEmail(
  queue: "invitation" | "website",
  id?: string,
  db = createAdminClient(),
  send = fetch,
) {
  const table =
    queue === "invitation" ? "store_invitations" : "store_website_emails";
  const claim =
    queue === "invitation"
      ? "claim_store_invitation_email"
      : "claim_store_website_email";
  const prefix = queue === "invitation" ? "store-invite" : "store-website";
  const key = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  if (!key || !from)
    throw new Error(
      "Email sending is not configured. Set RESEND_API_KEY and NOTIFICATION_FROM_EMAIL.",
    );
  const { data, error } = await db.rpc(claim, {
    p_id: id ?? null,
  });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return { sent: false };
  try {
    const response = await send("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `${prefix}-${job.id}`,
      },
      body: JSON.stringify(job.email_payload),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new Error(`Email provider returned ${response.status}.`);
    const result = await response.json();
    if (typeof result.id !== "string")
      throw new Error("Email provider did not confirm acceptance.");
    const { error: saveError } = await db
      .from(table)
      .update({
        email_status: "sent",
        sent_at: new Date().toISOString(),
        resend_id: result.id,
        last_error: null,
      })
      .eq("id", job.id)
      .eq("attempts", job.attempts);
    if (saveError) throw saveError;
    return { sent: true };
  } catch {
    const { error: saveError } = await db
      .from(table)
      .update({
        email_status: job.attempts >= 5 ? "failed" : "pending",
        last_error:
          "Email delivery was not confirmed. Automatic retry is scheduled unless all attempts have been used.",
        available_at: new Date(
          Date.now() + 60000 * 2 ** job.attempts,
        ).toISOString(),
      })
      .eq("id", job.id)
      .eq("attempts", job.attempts);
    if (saveError) throw saveError;
    return { sent: false };
  }
}
