"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { regenerateClaimToken } from "@/app/actions/stores";

interface ClaimLinkCardProps {
  storeId: string;
  claimToken: string;
}

export function ClaimLinkCard({ storeId, claimToken }: ClaimLinkCardProps) {
  const [token, setToken] = useState(claimToken);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const claimUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/claim/${token}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(claimUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerate() {
    setRegenerating(true);
    const result = await regenerateClaimToken(storeId);
    if (result.claimToken) {
      setToken(result.claimToken);
    }
    setRegenerating(false);
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Claim Link</CardTitle>
        <CardDescription>
          Send this link to the store owner so they can claim their store
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input value={claimUrl} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? "Regenerating..." : "Regenerate token"}
        </Button>
      </CardContent>
    </Card>
  );
}
