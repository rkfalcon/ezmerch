"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RetryFulfillmentButton({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleRetry() {
    if (!confirm("Retry Printful fulfillment for this order?")) return;
    setPending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/retry-fulfillment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (data.error) {
        setResult(data.error);
      } else {
        setResult("Retry triggered");
      }
    } catch {
      setResult("Failed");
    }
    setPending(false);
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleRetry}
        disabled={pending}
      >
        {pending ? "..." : "Retry"}
      </Button>
      {result && (
        <p className="text-xs text-muted-foreground mt-1">{result}</p>
      )}
    </div>
  );
}
