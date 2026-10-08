"use client";
import { minimumPrice } from "@/lib/lineup/minimum-price";
import { priceSize, sizesForPricing } from "@/lib/lineup/size-prices";
import { earningsEstimate, moneyRange } from "@/lib/product-earnings";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setProductPrice } from "@/app/actions/lineup-prices";
import { useRouter } from "next/navigation";

export function LineupProductPrice({
  productId,
  variants: input,
  template,
  readOnly = false,
}: {
  readOnly?: boolean;
  productId: string;
  variants: unknown;
  template?: {retail_price_cents:number;size_prices:Record<string,number> | null} | null;
}) {
  const variants = (typeof input === "string" ? JSON.parse(input) : input) as {
    size?: string | null;
    variant_id: number;
    name: string;
    retail_price: string;
  }[];
  const [costs, setCosts] = useState<Record<string, number> | null>(null);
  const [costError, setCostError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setCosts(null);
    setCostError(false);
    fetch(`/api/products/${productId}/earnings`, {signal:controller.signal,cache:"no-store"})
      .then(async response => { if (!response.ok) throw Error(); return response.json(); })
      .then(data => setCosts(data.costs))
      .catch(error => { if (error.name !== "AbortError") setCostError(true); });
    return () => controller.abort();
  }, [productId]);
  const sizes = sizesForPricing(variants);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState("all");
  const [price, setPrice] = useState(variants[0]?.retail_price ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const minimum = template ? Math.max(...variants
    .filter(v => variant === "all" || priceSize(v) === variant)
    .map(v => minimumPrice(v.size, template))) / 100 : 0.01;
  if (!variants.length) return null;
  const selectedVariants = variants.filter(v => variant === "all" || priceSize(v) === variant);
  const estimate = costs ? earningsEstimate(open ? selectedVariants : variants, costs, open ? Math.round(Number(price) * 100) : undefined) : null;
  const savedPrices = variants.map(v => Math.round(Number(v.retail_price) * 100)).filter(Number.isFinite);
  const earnings = <div className="text-xs space-y-1 whitespace-normal" aria-live="polite">
    <p className="font-medium">Estimated owner earnings: {estimate && !estimate.belowCost ? `${moneyRange(estimate.profitMin, estimate.profitMax)} per item` : estimate?.belowCost ? "Price is below production cost" : costs || costError ? "Unavailable" : "Loading…"}</p>
    {open && estimate && !estimate.belowCost && <p>Estimated production cost: {moneyRange(estimate.costMin, estimate.costMax)} per item</p>}
    {open && <p className="text-muted-foreground">Your estimated earnings = (selling price − production cost) × 70%. This estimate uses catalog costs for this product’s decoration technique; final order costs and any extra production charges can change earnings. Shipping and tax are excluded. Payout eligibility rules still apply.</p>}
  </div>;
  if (!open)
    return (
      <div className="space-y-2 mt-2 max-w-xs whitespace-normal">
      {savedPrices.length > 0 && <p className="text-xs">Selling price: {moneyRange(Math.min(...savedPrices), Math.max(...savedPrices))}</p>}
      {earnings}
      {!readOnly && <Button variant="outline" size="sm" onClick={() => { setPrice(selectedVariants[0]?.retail_price ?? variants[0].retail_price); setError(""); setOpen(true); }}>
        Edit price
      </Button>}
      </div>
    );
  async function save() {
    setBusy(true);
    setError("");
    try {
      const result = await setProductPrice(
        productId,
        Math.round(Number(price) * 100),
        variant === "all" ? undefined : variant,
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
    <div className="space-y-2 max-w-xs whitespace-normal">
      <select
        aria-label="Size to price"
        value={variant}
        onChange={(e) => {
          setVariant(e.target.value);
          setPrice(
            variants.find((v) => priceSize(v) === e.target.value)
              ?.retail_price ?? variants[0].retail_price,
          );
        }}
        className="w-full rounded border bg-background p-1 text-sm"
      >
        <option value="all">All sizes</option>
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">Applies to all colors in the selected size.</p>
      <Input
        aria-label="Retail price in dollars"
        type="number"
        step="0.01"
        min={minimum}
        value={price}
        onChange={(e) => setPrice(e.target.value)}
      />
      {template && <p className="text-xs text-muted-foreground">Minimum price: ${minimum.toFixed(2)}{variant === "all" ? " for all sizes" : ""}, set by the admin.</p>}
      {earnings}
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !price || Number(price) < minimum} onClick={save}>
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
