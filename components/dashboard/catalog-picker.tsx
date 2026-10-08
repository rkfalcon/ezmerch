"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { categorizeProduct, getCategoryList, matchesCatalogSearch } from "@/lib/printful-categories";
import { compareDelivery, type CatalogInsight } from "@/lib/lineup/catalog-insights";
import { selectedTechnique, matchesTechnique, templateTechnique, techniqueLabel } from "@/lib/lineup/catalog-techniques";
import { insideLabelPlacement } from "@/lib/lineup/inside-label";
import type { CatalogProduct, ProductTemplate } from "@/lib/lineup/types";

export function CatalogPicker({ products, templates, selectedId, onSelect }: {
  products: CatalogProduct[];
  templates: Pick<ProductTemplate, "catalog_product_id" | "active">[];
  selectedId: string;
  onSelect: (id: string, technique: string) => void;
}) {
  const [category, setCategory] = useState("All products");
  const [technique, setTechnique] = useState("all");
  const [insideLabelsOnly, setInsideLabelsOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(24);
  const [sort, setSort] = useState("delivery");
  const [insights, setInsights] = useState<Record<string, CatalogInsight>>({});
  const cache = useRef<Record<string, CatalogInsight>>({});
  const [quoteError, setQuoteError] = useState("");
  const [retry, setRetry] = useState(0);
  const active = products.filter((p) => !p.is_discontinued);
  const techniques = [...new Map(active.flatMap(p => (p.techniques ?? []).map(t =>
    [t.key.toUpperCase(), techniqueLabel(t.key, t.display_name)] as const
  ))).entries()].sort((a,b) => a[1].localeCompare(b[1]));
  const available = active.filter(p => matchesTechnique(p, technique) && (!insideLabelsOnly || !!insideLabelPlacement(p)));
  const counts = new Map<string, number>();
  for (const p of available) {
    const name = categorizeProduct(p.title);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const filtered = available.filter((p) =>
    (category === "All products" || categorizeProduct(p.title) === category) &&
    matchesCatalogSearch(p, search),
  );
  const ids = filtered.map((p) => `${p.id}:${templateTechnique(p, technique)}`).join(",");
  useEffect(() => {
    const controller = new AbortController();
    const pending = ids.split(",").filter(Boolean).filter((key) => !cache.current[key]);
    async function load() {
      setQuoteError("");
      for (let i = 0; i < pending.length; i += 4) {
        const start = Date.now();
        const response = await fetch("/api/lineup/catalog/insights", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: pending.slice(i, i + 4).map(key => Number(key.split(":")[0])), techniques: Object.fromEntries(pending.slice(i, i + 4).map(key => key.split(":"))) }), signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load prices and delivery estimates.");
        if (controller.signal.aborted) return;
        if (data.limited) throw new Error("Printful is busy. Wait a minute, then retry estimates.");
        for (const key of pending.slice(i, i + 4)) cache.current[key] = data.products[key.split(":")[0]];
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
  const insight = (p: CatalogProduct) => insights[`${p.id}:${templateTechnique(p, technique)}`];
  const sorted = [...filtered].sort((a, b) => sort === "delivery"
    ? compareDelivery(insight(a), insight(b)) || a.title.localeCompare(b.title)
    : a.title.localeCompare(b.title));
  const loaded = filtered.filter((p) => insight(p)).length;
  const selected = products.find((p) => String(p.id) === selectedId);
  const existing = new Map<number, { active: number; inactive: number }>();
  for (const template of templates) {
    if (template.catalog_product_id == null) continue;
    const counts = existing.get(template.catalog_product_id) ?? { active: 0, inactive: 0 };
    counts[template.active ? "active" : "inactive"]++;
    existing.set(template.catalog_product_id, counts);
  }
  return (
    <div className="space-y-4">
      <label className="block space-y-1 text-sm">
        Search Printful products
        <Input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(24); }} placeholder="Product name, brand, or model" />
      </label>
      <label className="block space-y-1 text-sm">
        Production technique
        <select className="block w-full rounded-md border bg-background p-2 sm:w-auto" value={technique}
          onChange={e => { setTechnique(e.target.value); setLimit(24); }}>
          <option value="all">All techniques</option>
          <option value="non-embroidery">Non-embroidery printing</option>
          {techniques.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">Matches any supported technique. Selecting a product uses the matching technique. Products without technique information appear under All techniques.</p>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={insideLabelsOnly} onChange={e => { setInsideLabelsOnly(e.target.checked); setCategory("All products"); setLimit(24); }} />
        Supports custom inside labels (native print)
      </label>
      <p className="text-xs text-muted-foreground">Compatible products receive the VeryMerch inside label automatically. Label printing is an additional production cost. Sewn-in and all-over-print label formats are not included.</p>
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
      <p className="text-xs text-muted-foreground">Blue cards marked “Already added” have existing templates, including inactive ones. Edit the existing template unless you intend to add another printing technique or configuration.</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">Sort by <select className="rounded-md border bg-background p-2" value={sort} onChange={(e) => setSort(e.target.value)}><option value="delivery">Fastest estimated delivery</option><option value="name">Product name</option></select></label>
        <span className="text-sm">Deliver to USA · 07751</span>
      </div>
      <p className="text-xs text-muted-foreground">Printful starting cost, before shipping, tax, and extras. Delivery compares one in-stock variant per product; colors, sizes, and shipping service can change the estimate. Quotes refresh periodically.</p>
      {loaded < filtered.length && !quoteError && <p role="status" className="text-sm">Loading prices and delivery: {loaded}/{filtered.length}. Results reorder as estimates arrive. Choose a category to narrow the comparison.</p>}
      {quoteError && <div role="alert" className="text-sm">{quoteError} <Button type="button" variant="outline" onClick={() => setRetry(retry + 1)}>Retry estimates</Button></div>}
      <div className="grid max-h-[34rem] grid-cols-2 gap-3 overflow-y-auto p-1 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.slice(0, limit).map((p) => (
          <button key={p.id} type="button" aria-pressed={String(p.id) === selectedId} onClick={() => onSelect(String(p.id), templateTechnique(p, technique))}
            className={`rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${existing.has(p.id) ? "border-blue-300 bg-blue-50 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:hover:bg-blue-900" : "bg-background hover:bg-muted"} ${String(p.id) === selectedId ? "ring-2 ring-primary" : ""}`}>
            {existing.has(p.id) && <span className="mb-2 block rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 dark:bg-blue-900 dark:text-blue-100">Already added · {existing.get(p.id)!.active} active / {existing.get(p.id)!.inactive} inactive</span>}
            {p.image ? <img src={p.image} alt={p.title} loading="lazy" className="mb-3 aspect-square w-full rounded-md bg-white object-contain" /> : <div className="mb-3 flex aspect-square items-center justify-center rounded-md bg-muted text-sm">Image unavailable</div>}
            <span className="block text-sm font-medium">{p.title}</span>
            <span className="block text-xs text-muted-foreground">{insideLabelPlacement(p) ? "VeryMerch inside label supported" : "Native inside label not supported"}</span>
            <span className="block text-xs text-muted-foreground">{selectedTechnique(p, technique) ? techniqueLabel(selectedTechnique(p, technique)!.key, selectedTechnique(p, technique)!.display_name) : "Technique unavailable"}</span>
            <span className="mt-2 flex flex-wrap gap-1" aria-label="Available colors">
              {!insight(p) ? <span className="text-xs text-muted-foreground">Loading colors…</span> : insight(p).colors == null ? <span className="text-xs text-muted-foreground">Colors unavailable</span> : insight(p).colors!.length ? insight(p).colors!.map((color) => (
                <span key={color.name} title={color.name} role="img" aria-label={color.name}
                  className="inline-block h-4 w-4 rounded-sm border border-black/25"
                  style={{ background: color.hex ? color.secondary ? `linear-gradient(135deg, ${color.hex} 50%, ${color.secondary} 50%)` : color.hex : "repeating-linear-gradient(45deg, #ddd, #ddd 3px, #fff 3px, #fff 6px)" }} />
              )) : <span className="text-xs text-muted-foreground">No in-stock color variants</span>}
            </span>
            <span className="mt-2 block text-sm font-semibold">{!insight(p) ? "Loading price…" : insight(p).price === null ? "Price unavailable" : `From ${new Intl.NumberFormat("en-US", { style: "currency", currency: insight(p).currency }).format(insight(p).price!)}`}</span>
            <span className="mt-1 block text-xs" title={insight(p)?.delivery?.variant}>{!insight(p) ? "Loading delivery…" : insight(p).delivery ? `Est. ${insight(p).delivery!.minDate} – ${insight(p).delivery!.maxDate}` : "Delivery estimate unavailable"}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{String(p.id) === selectedId ? "Selected" : "Select product"}</span>
          </button>
        ))}
      </div>
      {!filtered.length && <p role="status" className="text-sm">No products match. Try another technique, category or search.</p>}
      {filtered.length > limit && <Button type="button" variant="outline" onClick={() => setLimit(limit + 24)}>Show more products ({filtered.length - limit} remaining)</Button>}
    </div>
  );
}
