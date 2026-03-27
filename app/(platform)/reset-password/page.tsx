"use client";

import { useState } from "react";
import Link from "next/link";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setEmail(formData.get("email") as string);
    const result = await resetPassword(formData);
    if (result?.error) {
      setError(result.error);
    } else if (result?.sent) {
      setSent(true);
    }
    setPending(false);
  }

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
            <CardDescription>
              We sent a password reset link to <strong>{email}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Click the link in the email to set a new password.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link href="/login" className="text-sm text-primary underline">
              Back to login
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link href="/login" className="text-sm text-primary underline">
            Back to login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
