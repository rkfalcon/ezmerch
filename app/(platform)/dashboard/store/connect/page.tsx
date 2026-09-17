"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ConnectPage() {
  const [storeId, setStoreId] = useState<string | null>(null);
  const [status, setStatus] = useState<{
    ready: boolean;
    started: boolean;
    submitted?: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError("");
    try {
      const [storeResponse, statusResponse] = await Promise.all([
        fetch("/api/onboarding"),
        fetch("/api/onboarding/stripe-status"),
      ]);
      const [setup, nextStatus] = await Promise.all([
        storeResponse.json(),
        statusResponse.json(),
      ]);
      if (!storeResponse.ok || !statusResponse.ok)
        throw new Error(setup.error || nextStatus.error);
      if (!setup.store)
        throw new Error("Create your store first from Store setup.");
      setStoreId(setup.store.id);
      setStatus(nextStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load payout setup.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open Stripe.");
      setBusy(false);
    }
  }
  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Your payouts</h1>
      <p>
        Stripe securely handles your business verification and bank details.
      </p>
      {error && <p role="alert">{error}</p>}
      <p role="status">
        {status?.ready
          ? "Your account is ready to receive payouts."
          : status?.submitted
            ? "Stripe is reviewing your details. Continue setup if more information is needed."
            : status
              ? "Complete Stripe setup to receive payouts."
              : "Checking payout status…"}
      </p>
      {!status?.ready && (
        <Button onClick={connect} disabled={busy || !storeId}>
          {busy
            ? "Opening Stripe…"
            : status?.started
              ? "Continue Stripe setup"
              : "Set up payouts"}
        </Button>
      )}
      <Button variant="outline" onClick={load} disabled={busy}>
        Check status
      </Button>
    </div>
  );
}
