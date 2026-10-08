"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false),
    [fallback, setFallback] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFallback(false);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
      setFallback(true);
    }
  }
  return (
    <span className={className}>
      <Button type="button" size="sm" variant="outline" onClick={copy}>
        {copied ? "Copied!" : label}
      </Button>
      <span className="sr-only" role="status">
        {copied ? `${label}: copied to clipboard` : ""}
      </span>
      {fallback && (
        <span className="block mt-2 space-y-2">
          <span role="status" className="block text-sm">
            Select this text and use your device’s Copy command.
          </span>
          <textarea
            aria-label={`${label} — select and copy manually`}
            readOnly
            value={text}
            onFocus={(e) => e.target.select()}
            className="w-full min-h-24 rounded border p-2 text-sm"
          />
        </span>
      )}
    </span>
  );
}
