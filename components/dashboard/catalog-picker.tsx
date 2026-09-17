"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categorizeProduct, getCategoryList } from "@/lib/printful-categories";
import type { CatalogProduct } from "@/lib/lineup/types";

export function CatalogPicker({ products, selectedId, onSelect }: {
  products: CatalogProduct[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [category, setCategory] = useState("All products");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(24);
  const available = products.filter((p) => !p.is_discontinued);
  const counts = new Map<string, number>();
  for (const p of available) {
    const name = categorizeProduct(p.title);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const filtered = available.filter((p) =>
    (category === "All products" || categorizeProduct(p.title) === category) &&
    `${p.title} ${p.brand} ${p.model}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
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
      <div className="grid max-h-[34rem] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.slice(0, limit).map((p) => (
          <button key={p.id} type="button" aria-pressed={String(p.id) === selectedId} onClick={() => onSelect(String(p.id))}
            className={`rounded-lg border p-3 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 ${String(p.id) === selectedId ? "border-primary bg-muted ring-2 ring-primary" : "bg-background"}`}>
            {p.image ? <img src={p.image} alt={p.title} loading="lazy" className="mb-3 aspect-square w-full rounded-md bg-white object-contain" /> : <div className="mb-3 flex aspect-square items-center justify-center rounded-md bg-muted text-sm">Image unavailable</div>}
            <span className="block text-sm font-medium">{p.title}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{String(p.id) === selectedId ? "Selected" : "Select product"}</span>
          </button>
        ))}
      </div>
      {!filtered.length && <p role="status" className="text-sm">No products match. Try another category or search.</p>}
      {filtered.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(limit + 24)}>Show more products ({filtered.length - limit} remaining)</Button>}
    </div>
  );
}
