"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { issueRefund } from "@/app/actions/refunds";

export function RefundButton({ orderId }: { orderId: string }) {
  const [pending, setPending] = useState(false);
  const [refunded, setRefunded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefund() {
    if (!confirm("Are you sure you want to refund this order?")) return;
    setPending(true);
    setError(null);
    const result = await issueRefund(orderId);
    if (result.error) {
      setError(result.error);
    } else {
      setRefunded(true);
    }
    setPending(false);
  }

  if (refunded) {
    return <span className="text-xs text-muted-foreground">Refunded</span>;
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefund}
        disabled={pending}
      >
        {pending ? "..." : "Refund"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
