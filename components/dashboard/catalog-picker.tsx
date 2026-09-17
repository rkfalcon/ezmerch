"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categorizeProduct, getCategoryList, matchesCatalogSearch } from "@/lib/printful-categories";
import { compareDelivery, type CatalogInsight } from "@/lib/lineup/catalog-insights";
import type { CatalogProduct } from "@/lib/lineup/types";

export function CatalogPicker({ products, selectedId, onSelect }: {
  products: CatalogProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [category, setCategory] = useState("All products");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(24);
  const [sort, setSort] = useState("delivery");
  const [insights, setInsights] = useState<Record<number, CatalogInsight>>({});
  const cache = useRef<Record<number, CatalogInsight>>({});
  const [quoteError, setQuoteError] = useState("");
  const [retry, setRetry] = useState(0);
  const available = products.filter((p) => !p.is_discontinued);
  const counts = new Map<string, number>();
  for (const p of available) {
    const name = categorizeProduct(p.title);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const filtered = available.filter((p) =>
    (category === "All products" || categorizeProduct(p.title) === category) &&
    matchesCatalogSearch(p, search),
  );
  const ids = filtered.map((p) => p.id).join(",");
  useEffect(() => {
    const controller = new AbortController();
    const pending = ids.split(",").filter(Boolean).map(Number).filter((id) => !cache.current[id]);
    async function load() {
      setQuoteError("");
      for (let i = 0; i < pending.length; i += 4) {
        const start = Date.now();
        const response = await fetch("/api/lineup/catalog/insights", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: pending.slice(i, i + 4) }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load prices and delivery estimates.");
        if (controller.signal.aborted) return;
        if (data.limited) throw new Error("Printful is busy. Wait a minute, then retry estimates.");
        Object.assign(cache.current, data.products);
        setInsights({ ...cache.current });
        // Keep catalog browsing below Printful's request limit, including shipping quotes.
        if (i + 4 < pending.length) await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, Math.max(0, 5000 - (Date.now() - start)));
          controller.signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
        });
      }
    }
    load().catch((e) => { if (!controller.signal.aborted) setQuoteError(e.message); });
    return () => controller.abort();
  }, [ids, retry]);
  const sorted = [...filtered].sort((a, b) => sort === "delivery"
    ? compareDelivery(insights[a.id], insights[b.id]) || a.title.localeCompare(b.title)
    : a.title.localeCompare(b.title));
  const loaded = filtered.filter((p) => insights[p.id]).length;
  const selected = products.find((p) => String(p.id) === selectedId);
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        Search Printful products
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(24); }} placeholder="Product name, brand, or model" />
      </label>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Product categories">
        {["All products", ...getCategoryList().filter((name) => counts.has(name))].map((name) => (
          <Button key={name} type="button" size="sm" variant={category === name ? "default" : "outline"} aria-pressed={category === name}
            onClick={() => { setCategory(name); setLimit(24); }}>
            {name} ({name === "All products" ? available.length : counts.get(name)})
          </Button>
        ))}
      </div>
      {selected && <p className="rounded-md border bg-muted p-3 text-sm" role="status">Selected: <strong>{selected.title}</strong></p>}
      <p className="text-sm text-muted-foreground">{filtered.length} products · Select an image to configure its template. Images are Printful catalog samples.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Sort by <select className="rounded-md border bg-background p-2" value={sort} onChange={(e) => setSort(e.target.value)}><option value="delivery">Fastest estimated delivery</option><option value="name">Product name</option></select></label>
        <span className="text-sm">Deliver to USA · 07751</span>
      </div>
      <p className="text-xs text-muted-foreground">Printful starting cost, before shipping, tax, and extras. Delivery compares one in-stock variant per product; colors, sizes, and shipping service can change the estimate. Quotes refresh periodically.</p>
      {loaded < filtered.length && !quoteError && <p role="status" className="text-sm">Loading prices and delivery: {loaded}/{filtered.length}. Results reorder as estimates arrive. Choose a category to narrow the comparison.</p>}
      {quoteError && <div role="alert" className="text-sm">{quoteError} <Button type="button" variant="outline" onClick={() => setRetry(retry + 1)}>Retry estimates</Button></div>}
      <div className="grid max-h-[34rem] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.slice(0, limit).map((p) => (
          <button key={p.id} type="button" aria-pressed={String(p.id) === selectedId} onClick={() => onSelect(String(p.id))}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 ${String(p.id) === selectedId ? "border-primary bg-muted ring-2 ring-primary" : "bg-background"}`}>
            {p.image ? <img src={p.image} alt={p.title} loading="lazy" className="mb-3 aspect-square w-full rounded-md bg-white object-contain" /> : <div className="mb-3 flex aspect-square items-center justify-center rounded-md bg-muted text-sm">Image unavailable</div>}
            <span className="block text-sm font-medium">{p.title}</span>
            <span className="mt-2 block text-sm font-semibold">{!insights[p.id] ? "Loading price…" : insights[p.id].price === null ? "Price unavailable" : `From ${new Intl.NumberFormat("en-US", { style: "currency", currency: insights[p.id].currency }).format(insights[p.id].price!)}`}</span>
            <span className="mt-1 block text-xs" title={insights[p.id]?.delivery?.variant}>{!insights[p.id] ? "Loading delivery…" : insights[p.id].delivery ? `Est. ${insights[p.id].delivery!.minDate} – ${insights[p.id].delivery!.maxDate}` : "Delivery estimate unavailable"}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{String(p.id) === selectedId ? "Selected" : "Select product"}</span>
          </button>
        ))}
      </div>
      {!filtered.length && <p role="status" className="text-sm">No products match. Try another category or search.</p>}
      {filtered.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(limit + 24)}>Show more products ({filtered.length - limit} remaining)</Button>}
    </div>
  );
}
