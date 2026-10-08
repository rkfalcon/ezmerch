"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  renderInvitation,
  type InvitationTemplate,
  type InvitationStore,
} from "@/lib/invitations/email";
import {
  saveInvitationTemplate,
  sendStoreInvitation,
  revokeStoreInvitation,
} from "@/app/actions/invitations";

type Invite = {
  id: string;
  recipient_email: string;
  created_at: string;
  expires_at: string;
  sent_at: string | null;
  email_status: string;
  accepted_at: string | null;
  revoked_at: string | null;
  last_error: string | null;
};
export function StoreInvitation({
  storeId,
  store,
  template,
  invitations = [],
  defaultsOnly = false,
  origin,
}: {
  storeId?: string;
  store: InvitationStore;
  template: InvitationTemplate;
  invitations?: Invite[];
  defaultsOnly?: boolean;
  origin: string;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const preview = renderInvitation(
    { subject, body },
    store,
    origin,
    `${origin}/claim/email-preview`,
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = defaultsOnly
        ? await saveInvitationTemplate({ subject, body })
        : await sendStoreInvitation(storeId!, email, { subject, body });
      if (result.error) setError(result.error);
      else {
        setMessage(
          "message" in result && typeof result.message === "string"
            ? result.message
            : "Default invitation saved. Future invitations will use this message.",
        );
        router.refresh();
      }
    } catch {
      setError("Could not complete the request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function revoke(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await revokeStoreInvitation(id, storeId!);
      if (result.error) setError(result.error);
      else {
        setMessage(
          "Invitation revoked. Its link can no longer claim the store.",
        );
        router.refresh();
      }
    } catch {
      setError("Could not revoke the invitation.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-xl border p-5 space-y-5">
      <div>
        <h2 className="text-xl font-semibold">
          {defaultsOnly
            ? "Invitation email template"
            : "Invite the store owner"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {defaultsOnly
            ? "Customize the default email for every store invitation."
            : "Send a personal invitation to claim this store. The recipient can create an account or sign in with the invited email."}
        </p>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <form onSubmit={submit} className="space-y-4">
          {!defaultsOnly && (
            <label className="block space-y-2">
              <span>Owner’s email</span>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                maxLength={254}
              />
            </label>
          )}
          <label className="block space-y-2">
            <span>Subject</span>
            <Input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="block space-y-2">
            <span>Email message</span>
            <Textarea
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              maxLength={10000}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Use {"{store_name}"}, {"{store_url}"}, and {"{claim_url}"}. Your
            message appears above the storefront preview. The claim button and
            seven-day expiry notice are always included.
          </p>
          {!defaultsOnly && (
            <p className="text-sm">
              Changes here apply to this invitation.{" "}
              <Link className="underline" href="/dashboard/admin/emails">
                Edit the default email
              </Link>
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="text-sm">
              {message}
            </p>
          )}
          {!defaultsOnly && (
            <p className="text-xs text-muted-foreground">
              Sending a new invitation replaces the previous claim link. This
              does not change the store’s products or prices.
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy
              ? "Working…"
              : defaultsOnly
                ? "Save default email"
                : "Send store invitation"}
          </Button>
        </form>
        <div className="min-w-0">
          <h3 className="font-medium mb-2">Email preview</h3>
          <p className="text-sm mb-3 break-words">{preview.subject}</p>
          <iframe
            title="Store invitation email preview"
            sandbox=""
            srcDoc={preview.html}
            className="w-full h-[560px] rounded-lg border bg-muted"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {store.products.length} products included. Images appear when
            available. Email apps may require the recipient to enable images.
          </p>
        </div>
      </div>
      {!defaultsOnly && invitations.length > 0 && (
        <div className="space-y-3 border-t pt-4">
          <h3 className="font-medium">Recent invitations</h3>
          {invitations.map((inv) => {
            const expired = new Date(inv.expires_at).getTime() <= Date.now();
            const stale =
              inv.email_status === "pending" &&
              new Date(inv.created_at).getTime() <
                Date.now() - 23 * 60 * 60 * 1000;
            const status = inv.accepted_at
              ? "Accepted"
              : inv.revoked_at
                ? "Revoked"
                : expired
                  ? "Expired"
                  : stale
                    ? "Delivery unconfirmed — send a new invitation"
                    : inv.email_status === "sent"
                      ? "Sent — awaiting acceptance"
                      : inv.email_status === "failed"
                        ? "Sending failed — send a new invitation"
                        : "Queued for delivery";
            return (
              <div
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <div>
                  <p className="font-medium break-all">{inv.recipient_email}</p>
                  <p>{status}</p>
                  <p className="text-xs text-muted-foreground">
                    Expires {new Date(inv.expires_at).toLocaleString()}
                  </p>
                  {inv.last_error && !inv.revoked_at && !inv.accepted_at && (
                    <p className="text-xs">{inv.last_error}</p>
                  )}
                </div>
                {!inv.accepted_at && !inv.revoked_at && !expired && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => revoke(inv.id)}
                  >
                    Revoke invitation
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
