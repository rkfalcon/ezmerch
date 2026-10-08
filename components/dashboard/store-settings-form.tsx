"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateStoreSettings } from "@/app/actions/store-settings";

interface StoreSettingsFormProps {
  store: {
    name: string;
    slug: string;
    brand_colors: { primary: string; accent: string };
    shipping_policy: string;
    shipping_discount_cents: number | null;
  };
}

export function StoreSettingsForm({ store }: StoreSettingsFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(false);
    formData.set("shippingPolicy", "passthrough");
    formData.set("shippingDiscountCents", "0");
    formData.set("slug", store.slug);
    const result = await updateStoreSettings(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
    setPending(false);
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Settings saved successfully!
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
          <CardDescription>Your store URL: verymerch.com/{store.slug}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="name">Store Name</Label>
            <Input id="name" name="name" defaultValue={store.name} required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <Input
                id="primaryColor"
                name="primaryColor"
                type="color"
                defaultValue={store.brand_colors.primary}
                className="h-10 w-16 p-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <Input
                id="accentColor"
                name="accentColor"
                type="color"
                defaultValue={store.brand_colors.accent}
                className="h-10 w-16 p-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
        <CardContent>Customers pay the full shipping cost at checkout. Shipping is separate from the 70/30 merchandise profit split.</CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
