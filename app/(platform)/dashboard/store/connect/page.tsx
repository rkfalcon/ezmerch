"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  );
}

function ConnectContent() {
  const searchParams = useSearchParams();
  const success = searchParams.get("success");
  const refresh = searchParams.get("refresh");

  const [store, setStore] = useState<{
    id: string;
    stripe_account_id: string | null;
    claimed: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    async function loadStore() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("store_id")
        .eq("user_id", user.id)
        .eq("role", "store_owner")
        .single();

      if (roles?.store_id) {
        const { data } = await supabase
          .from("stores")
          .select("id, stripe_account_id, claimed")
          .eq("id", roles.store_id)
          .single();
        setStore(data);
      }
      setLoading(false);
    }
    loadStore();
  }, []);

  async function handleConnect() {
    if (!store) return;
    setConnecting(true);

    const res = await fetch("/api/stripe/connect/onboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id }),
    });

    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setConnecting(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!store) {
    return <div className="text-muted-foreground">No store found.</div>;
  }

  const isConnected = !!store.stripe_account_id;

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Stripe Connect</h1>
        <p className="text-muted-foreground">
          Connect your Stripe account to receive payouts
        </p>
      </div>

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Stripe onboarding completed! Your account is being verified.
        </div>
      )}

      {refresh && (
        <div className="mb-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
          Your onboarding session expired. Click below to continue.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Stripe Account
            {isConnected ? (
              <Badge variant="default">Connected</Badge>
            ) : (
              <Badge variant="secondary">Not Connected</Badge>
            )}
          </CardTitle>
          <CardDescription>
            {isConnected
              ? "Your Stripe account is connected. You'll receive 60% of each sale's product subtotal."
              : "Connect your Stripe account to start receiving payouts. You'll earn 60% of each sale's product subtotal."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="text-sm text-muted-foreground">
              <p>Account ID: {store.stripe_account_id}</p>
              <p className="mt-1">
                Payouts are managed by Stripe. You can access your Express
                dashboard through Stripe.
              </p>
            </div>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? "Redirecting to Stripe..." : "Connect with Stripe"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
