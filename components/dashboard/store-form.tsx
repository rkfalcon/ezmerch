"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { createStore, updateStore } from "@/app/actions/stores";

interface StoreFormProps {
  store?: {
    id: string;
    name: string;
    slug: string;
    brand_colors: { primary: string; accent: string };
    shipping_policy: string;
    shipping_discount_cents: number | null;
    claim_token: string | null;
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export function StoreForm({ store }: StoreFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(store?.name ?? "");
  const [slug, setSlug] = useState(store?.slug ?? "");
  const [shippingPolicy, setShippingPolicy] = useState(
    store?.shipping_policy ?? "passthrough"
  );

  const isEditing = !!store;

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    formData.set("shippingPolicy", shippingPolicy);

    const result = isEditing
      ? await updateStore(store.id, formData)
      : await createStore(formData);

    if ("error" in result && result.error) {
      setError(result.error);
      setPending(false);
    } else {
      router.push("/dashboard/admin/stores");
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Store Details</CardTitle>
          <CardDescription>Basic information about the store</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Store Name</Label>
            <Input
              id="name"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEditing) setSlug(slugify(e.target.value));
              }}
              placeholder="My Awesome Store"
              required
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  ezmerch.store/
                </span>
                <Input
                  id="slug"
                  name="slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  placeholder="my-store"
                  required
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Colors for the store&apos;s storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="primaryColor"
                  name="primaryColor"
                  type="color"
                  defaultValue={store?.brand_colors?.primary ?? "#000000"}
                  className="h-10 w-16 p-1"
                />
                <Input
                  type="text"
                  defaultValue={store?.brand_colors?.primary ?? "#000000"}
                  className="font-mono text-sm"
                  onChange={(e) => {
                    const colorInput = document.getElementById("primaryColor") as HTMLInputElement;
                    if (colorInput) colorInput.value = e.target.value;
                  }}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accentColor">Accent Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="accentColor"
                  name="accentColor"
                  type="color"
                  defaultValue={store?.brand_colors?.accent ?? "#3b82f6"}
                  className="h-10 w-16 p-1"
                />
                <Input
                  type="text"
                  defaultValue={store?.brand_colors?.accent ?? "#3b82f6"}
                  className="font-mono text-sm"
                  onChange={(e) => {
                    const colorInput = document.getElementById("accentColor") as HTMLInputElement;
                    if (colorInput) colorInput.value = e.target.value;
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Shipping</CardTitle>
          <CardDescription>
            How shipping costs are handled for this store
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Shipping Policy</Label>
            <Select value={shippingPolicy} onValueChange={(v) => { if (v) setShippingPolicy(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="passthrough">
                  Pass through at cost
                </SelectItem>
                <SelectItem value="free">Free shipping (store covers)</SelectItem>
                <SelectItem value="flat_discount">
                  Flat discount on shipping
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {shippingPolicy === "flat_discount" && (
            <div className="space-y-2">
              <Label htmlFor="shippingDiscountCents">
                Shipping Discount (cents)
              </Label>
              <Input
                id="shippingDiscountCents"
                name="shippingDiscountCents"
                type="number"
                min="0"
                defaultValue={store?.shipping_discount_cents ?? ""}
                placeholder="500 = $5.00 discount"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending
            ? isEditing
              ? "Saving..."
              : "Creating..."
            : isEditing
              ? "Save Changes"
              : "Create Store"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/admin/stores")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
