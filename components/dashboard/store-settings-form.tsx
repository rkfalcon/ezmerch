"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [shippingPolicy, setShippingPolicy] = useState(store.shipping_policy);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSuccess(false);
    formData.set("shippingPolicy", shippingPolicy);
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
          <CardDescription>Your store URL: ezmerch.store/{store.slug}</CardDescription>
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
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Shipping Policy</Label>
            <Select value={shippingPolicy} onValueChange={(v) => { if (v) setShippingPolicy(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passthrough">Pass through at cost</SelectItem>
                <SelectItem value="free">Free shipping (you cover)</SelectItem>
                <SelectItem value="flat_discount">Flat discount on shipping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {shippingPolicy === "flat_discount" && (
            <div className="space-y-2">
              <Label htmlFor="shippingDiscountCents">Discount (cents)</Label>
              <Input
                id="shippingDiscountCents"
                name="shippingDiscountCents"
                type="number"
                min="0"
                defaultValue={store.shipping_discount_cents ?? ""}
                placeholder="500 = $5.00 discount"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving..." : "Save Settings"}
      </Button>
    </form>
  );
}
