"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CopyButton } from "./copy-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  storeSharingGuide,
  renderDeveloperEmail,
  type SharingStore,
  type DeveloperTemplate,
} from "@/lib/sharing/guide";
import { emailStoreInstructions } from "@/app/actions/store-sharing";
type EmailStatus = {
  id: string;
  recipient_email: string;
  email_status: string;
  created_at: string;
  last_error: string | null;
};
export function StoreSharing({
  store,
  template,
  recent = [],
}: {
  store: SharingStore & { id: string };
  template: DeveloperTemplate;
  recent?: EmailStatus[];
}) {
  const guide = storeSharingGuide(store);
  const email = renderDeveloperEmail(template, store);
  const [recipient, setRecipient] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const requestId = useRef<string | null>(null);
  const router = useRouter();
  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      const result = await emailStoreInstructions(
        store.id,
        recipient,
        requestId.current,
      );
      if (result.error) setError(result.error);
      else {
        setMessage(result.message!);
        requestId.current = null;
        router.refresh();
      }
    } catch {
      setError(
        "Could not confirm the send. Try again; the same request will not send a duplicate email.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Share your store</h1>
        <p className="text-muted-foreground mt-2">
          Add a “Shop our merch” link to your website so visitors can find{" "}
          {store.name}. Choose your website below, or send everything to your
          developer.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <a
          href="#email-developer"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Email instructions to your developer
        </a>
        <CopyButton text={guide.instructions} label="Copy all instructions" />
      </div>
      <section className="rounded-xl border p-5 space-y-4">
        <h2 className="text-xl font-semibold">Ask your AI agent to add your store</h2>
        <p className="text-sm text-muted-foreground">
          Copy this prompt into the AI agent or LLM you use to manage your website.
          It already includes your store link. Give the agent your existing website
          address and review its changes before publishing.
        </p>
        <CopyButton text={guide.agentPrompt} label="Copy AI agent instructions" />
        <textarea
          aria-label="AI agent instructions"
          readOnly
          value={guide.agentPrompt}
          onFocus={(e) => e.target.select()}
          className="w-full min-h-64 rounded-md border bg-muted/50 p-3 text-sm"
        />
      </section>
      <div className="space-y-3">
        {guide.platforms.map((platform) => (
          <details key={platform.name} className="rounded-xl border group">
            <summary className="cursor-pointer px-5 py-4 font-semibold">
              {platform.name}
            </summary>
            <div className="space-y-4 px-5 pb-5">
              <ol className="list-decimal pl-5 space-y-3 text-sm leading-6">
                {platform.steps.map((step) => (
                  <li key={step} className="break-words">
                    {step}
                  </li>
                ))}
              </ol>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={guide.url} label="Copy store URL" />
                <CopyButton text={guide.label} label="Copy link text" />
                <CopyButton
                  text={`${platform.name}\n${platform.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}${platform.source ? `\nOfficial help: ${platform.source}` : ""}${platform.source ? "" : `\n\n${guide.linkCode}\n\n${guide.buttonCode}`}`}
                  label="Copy these instructions"
                />
              </div>
              {platform.name === "Google Business Profile" && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm mb-3">{guide.postText}</p>
                  <CopyButton text={guide.postText} label="Copy announcement" />
                </div>
              )}
              {platform.name === "HTML / any website" && (
                <div className="space-y-5">
                  {[
                    { title: "Simple text link", code: guide.linkCode },
                    { title: "Styled button", code: guide.buttonCode },
                  ].map((item) => (
                    <div key={item.title}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-medium">{item.title}</h3>
                        <CopyButton
                          text={item.code}
                          label={`Copy ${item.title.toLowerCase()}`}
                        />
                      </div>
                      <textarea
                        aria-label={`${item.title} HTML code`}
                        readOnly
                        value={item.code}
                        onFocus={(e) => e.target.select()}
                        className="w-full min-h-28 rounded-md border bg-muted/50 p-3 font-mono text-xs"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Paste into your website’s HTML/code editor.
                      </p>
                    </div>
                  ))}
                  <div>
                    <p className="text-sm mb-2">Button preview</p>
                    <a
                      href={guide.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-block",
                        padding: "12px 20px",
                        backgroundColor: "#18181b",
                        color: "#fff",
                        borderRadius: 8,
                        textDecoration: "none",
                        fontFamily: "Arial, sans-serif",
                        fontWeight: "bold",
                      }}
                    >
                      {guide.label}
                    </a>
                  </div>
                </div>
              )}
              {platform.source && (
                <a
                  href={platform.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm underline"
                >
                  Official {platform.name} help ↗
                </a>
              )}
            </div>
          </details>
        ))}
      </div>
      <section
        id="email-developer"
        className="scroll-mt-6 rounded-xl border p-5 space-y-4"
      >
        <h2 className="text-xl font-semibold">Email your web developer</h2>
        <p className="text-sm text-muted-foreground">
          We’ll send all five sets of instructions, your store URL, and both
          HTML examples, plus the ready-to-copy AI agent prompt. Your developer won’t need an VeryMerch account. Replies
          go to your account email.
        </p>
        <form onSubmit={send} className="space-y-3">
          <label className="block max-w-lg space-y-2">
            <span className="text-sm font-medium">
              Developer’s email address
            </span>
            <Input
              type="email"
              required
              maxLength={254}
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value);
                requestId.current = null;
              }}
              placeholder="developer@example.com"
              disabled={busy}
            />
          </label>
          <Button type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send all instructions"}
          </Button>
        </form>
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
        <details>
          <summary className="cursor-pointer text-sm underline">
            Preview email and copy its contents
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm font-medium">Subject: {email.subject}</p>
            <CopyButton
              text={`${email.subject}\n\n${email.text}`}
              label="Copy complete email"
            />
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border p-4 text-sm font-sans">
              {email.text}
            </pre>
          </div>
        </details>
        {recent.length > 0 && (
          <div className="border-t pt-3">
            <h3 className="font-medium text-sm mb-2">
              Recent instruction emails
            </h3>
            <ul className="space-y-2 text-sm">
              {recent.map((item) => (
                <li key={item.id} className="break-all">
                  {item.recipient_email} ·{" "}
                  {item.email_status === "sent"
                    ? "Sent"
                    : item.email_status === "failed"
                      ? "Delivery failed — send a new email"
                      : "Queued for delivery"}
                  {item.email_status === "failed" && item.last_error && (
                    <p className="text-xs text-muted-foreground">
                      {item.last_error}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => router.refresh()}
            >
              Refresh delivery status
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
