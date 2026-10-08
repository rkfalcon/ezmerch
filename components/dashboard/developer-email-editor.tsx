"use client";
import { useState, useTransition } from "react";
import { saveDeveloperEmailTemplate } from "@/app/actions/store-sharing";
import {
  renderDeveloperEmail,
  type DeveloperTemplate,
} from "@/lib/sharing/guide";
export function DeveloperEmailEditor({
  template,
}: {
  template: DeveloperTemplate;
}) {
  const [draft, setDraft] = useState(template);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const preview = renderDeveloperEmail(draft, {
    name: "Your Store",
    slug: "your-store",
  });
  return (
    <div className="space-y-4 pt-5">
      <p className="text-sm text-muted-foreground">
        This email is sent when a store owner emails website instructions to
        their developer. All five platform guides and both HTML examples are
        always included.
      </p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            try {
              const result = await saveDeveloperEmailTemplate(draft);
              setMessage(result.error ?? "Email template saved.");
            } catch {
              setMessage("Could not save. Please try again.");
            }
          });
        }}
      >
        <label className="block space-y-2">
          <span>Subject</span>
          <input
            required
            maxLength={200}
            className="w-full rounded border p-2"
            value={draft.subject}
            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
          />
        </label>
        <label className="block space-y-2">
          <span>Body</span>
          <textarea
            required
            maxLength={15000}
            rows={12}
            className="w-full rounded border p-2"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>
        <p className="text-sm text-muted-foreground">
          Use {"{store_name}"} and {"{store_url}"} to personalize the message.
          Place {"{instructions}"} where the complete guide should appear; if
          omitted, the guide is appended. You can also insert {"{html_link}"} or{" "}
          {"{html_button}"} in the body. HTML is displayed as copyable code.
        </p>
        <button
          disabled={pending}
          className="rounded bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save developer email"}
        </button>
        <p role="status">{message}</p>
      </form>
      <h3 className="font-semibold">Email preview</h3>
      <p className="break-words text-sm">Subject: {preview.subject}</p>
      <iframe
        title="Developer instructions email preview"
        sandbox=""
        srcDoc={preview.html}
        className="h-[600px] w-full rounded border bg-white"
      />
    </div>
  );
}
