"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setProductPrice } from "@/app/actions/lineup-prices";
import { useRouter } from "next/navigation";

export function LineupProductPrice({
  productId,
  variants: input,
}: {
  productId: string;
  variants: unknown;
}) {
  const variants = (typeof input === "string" ? JSON.parse(input) : input) as {
    variant_id: number;
    name: string;
    retail_price: string;
  }[];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState("all");
  const [price, setPrice] = useState(variants[0]?.retail_price ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!variants.length) return null;
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Edit price
      </Button>
    );
  async function save() {
    setBusy(true);
    try {
      const result = await setProductPrice(
        productId,
        Math.round(Number(price) * 100),
        variant === "all" ? undefined : Number(variant),
      );
      if (result.error) setError(result.error);
      else {
        setOpen(false);
        router.refresh();
      }
    } catch {
      setError("Price could not be saved");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2 max-w-xs">
      <select
        aria-label="Variant to price"
        value={variant}
        onChange={(e) => {
          setVariant(e.target.value);
          setPrice(
            variants.find((v) => v.variant_id === Number(e.target.value))
              ?.retail_price ?? variants[0].retail_price,
          );
        }}
        className="w-full rounded border bg-background p-1 text-sm"
      >
        <option value="all">All variants</option>
        {variants.map((v) => (
          <option key={v.variant_id} value={v.variant_id}>
            {v.name}
          </option>
        ))}
      </select>
      <Input
        aria-label="Retail price in dollars"
        type="number"
        step="0.01"
        min="0.01"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy} onClick={save}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
