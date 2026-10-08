"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { claimStore, switchClaimAccount } from "@/app/actions/claim";

interface ClaimStoreCardProps {
  store: {
    id: string;
    name: string;
    slug: string;
    brand_colors: { primary: string; accent: string };
  };
  token: string;
  isAuthenticated: boolean;
  email?: string;
}

export function ClaimStoreCard({
  store,
  token,
  isAuthenticated,
  email,
}: ClaimStoreCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState(false);

  async function handleClaim() {
    setPending(true);
    setError(null);
    let result;
    try {
      result = await claimStore(token);
    } catch {
      setError("Could not claim your store. Please try again.");
      setPending(false);
      return;
    }
    if (result.error) {
      setError(result.error);
      setPending(false);
    } else {
      setClaimed(true);
      router.push("/dashboard/store");
      router.refresh();
    }
  }

  if (claimed) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Store Claimed!</CardTitle>
          <CardDescription>
            Redirecting you to your dashboard...
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
          style={{ backgroundColor: store.brand_colors.primary }}
        >
          {store.name.charAt(0).toUpperCase()}
        </div>
        <CardTitle className="text-2xl">{store.name}</CardTitle>
        <CardDescription>
          You&apos;ve been invited to claim this store on VeryMerch
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md bg-muted p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Store URL</span>
            <span className="font-mono">verymerch.com/{store.slug}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Brand Color</span>
            <div className="flex items-center gap-2">
              <div
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: store.brand_colors.primary }}
              />
              <div
                className="h-4 w-4 rounded-full border"
                style={{ backgroundColor: store.brand_colors.accent }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        {isAuthenticated ? (
          <>
            <p className="text-sm break-all">Signed in as {email}</p>
            <Button onClick={handleClaim} disabled={pending} className="w-full">
              {pending ? "Claiming..." : "Accept & claim this store"}
            </Button>
            <form action={switchClaimAccount.bind(null, token)}>
              <Button variant="ghost" type="submit" disabled={pending}>
                Use a different account
              </Button>
            </form>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground text-center">
              Sign up or log in to claim this store
            </p>
            <div className="flex gap-3 w-full">
              <Link href={`/signup?next=/claim/${token}`} className="flex-1">
                <Button className="w-full">Sign Up</Button>
              </Link>
              <Link href={`/login?next=/claim/${token}`} className="flex-1">
                <Button variant="outline" className="w-full">
                  Log In
                </Button>
              </Link>
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
