"use client";

import { SupplierStockStatus } from "./supplier-stock-status";
import {
  ColorAvailabilityPills,
  enabledProductClass,
  disabledProductClass,
} from "@/components/dashboard/product-availability";
import { ProductColorPreview } from "@/components/dashboard/product-color-preview";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CatalogPicker } from "@/components/dashboard/catalog-picker";
import { categorizeProduct } from "@/lib/printful-categories";
import { leftChestPlacement, printfulPlacement } from "@/lib/lineup/placement";
import { retailPrice } from "@/lib/lineup/pricing";
import type {
  CatalogProduct,
  CatalogVariant,
  Printfiles,
  ProductTemplate,
} from "@/lib/lineup/types";

export function LineupTemplates({
  templates,
  previews = {},
}: {
  templates: ProductTemplate[];
  previews?: Record<string, { thumbnail_url: string | null; colors: string[]; catalog?: boolean }>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<ProductTemplate | null | undefined>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function mutate(body: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/lineup/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessage(
        data.errors?.length
          ? `${data.activated} activated. ${data.errors.join("; ")}`
          : "Saved. Global availability applies to all stores. Store preferences are preserved.",
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not save templates",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Product templates</h1>
          <p className="text-muted-foreground">
            Your shared lineup. Each store supplies its own logo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            variant="outline"
            onClick={() => mutate({ action: "activate-presets" })}
          >
            Activate inactive templates
          </Button>
          <Button onClick={() => setEditing(null)}>Add template</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        New stores start live. New additions to stores with products stay drafts
        and notify the owner and admins. Product and color availability apply to
        all stores immediately. Design and pricing edits apply to future
        generation.
      </p>
      {message && (
        <p
          role="status"
          className="rounded-md border p-3 text-sm whitespace-pre-wrap"
        >
          {message}
        </p>
      )}
      {editing !== undefined && (
        <TemplateEditor
          key={editing?.id ?? "new"}
          template={editing}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            router.refresh();
          }}
        />
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <Card
            key={t.id}
            className={t.active ? enabledProductClass : disabledProductClass}
          >
            <CardHeader>
              <p className="text-xs text-muted-foreground">
                {t.category} · {t.active ? "Active" : "Inactive"}
              </p>
              <ProductColorPreview
                scope="global"
                product={{
                  id: t.id,
                  title: t.title,
                  thumbnail_url: previews[t.id]?.thumbnail_url ?? null,
                }}
              />
            </CardHeader>
            <CardContent className="space-y-3">
              <SupplierStockStatus stock={t.supplier_stock} error={t.stock_check_error} />
              {previews[t.id]?.catalog && <p className="text-xs text-muted-foreground">Catalog preview · branded mockup appears after generation finishes.</p>}
              <p className="font-semibold">
                {Object.keys(t.size_prices).length ? "From " : ""}$
                {(t.retail_price_cents / 100).toFixed(2)}
              </p>
              <p className="text-sm text-muted-foreground">
                All available sizes · {t.placement.replaceAll("_", " ")} ·{" "}
                {Math.round(Number(t.scale) * 100)}% logo scale
              </p>
              {previews[t.id]?.colors && (
                <ColorAvailabilityPills
                  colors={previews[t.id].colors}
                  productEnabled={t.active}
                  enabledColors={t.enabled_colors}
                  scope="global"
                />
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditing(t)}
                >
                  Edit
                </Button>
                <Button
                  disabled={busy}
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    mutate({
                      action: t.active ? "disable" : "enable",
                      id: t.id,
                    })
                  }
                >
                  {t.active ? "Disable globally" : "Enable globally"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TemplateEditor({
  template,
  onClose,
  onSaved,
}: {
  template: ProductTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [catalog, setCatalog] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [productId, setProductId] = useState(
    template?.catalog_product_id?.toString() ?? "",
  );
  const [title, setTitle] = useState(template?.title ?? "");
  const [category, setCategory] = useState(template?.category ?? "T-Shirts");
  const [price, setPrice] = useState(
    ((template?.retail_price_cents ?? 0) / 100).toFixed(2),
  );
  const [technique, setTechnique] = useState(template?.technique ?? "dtg");
  const [placement, setPlacement] = useState(template?.placement ?? "front");
  const [scale, setScale] = useState(
    Math.round(Number(template?.scale ?? 0.8) * 100),
  );
  const [group, setGroup] = useState(template?.option_groups[0] ?? "");
  const [sizes, setSizes] = useState(
    Object.entries(template?.size_prices ?? {})
      .map(([size, cents]) => `${size}=${(cents / 100).toFixed(2)}`)
      .join("\n"),
  );
  const [files, setFiles] = useState<Printfiles | null>(null);
  const [variants, setVariants] = useState<CatalogVariant[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/lineup/catalog", { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setCatalog(d.products);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!productId) return;
    const controller = new AbortController();
    setLoading(true);
    setFiles(null);
    setError("");
    fetch(
      `/api/lineup/catalog?productId=${productId}&technique=${encodeURIComponent(technique)}`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setFiles(d.files);
        setVariants(d.variants);
        setPlacement((current) =>
          d.files.available_placements[printfulPlacement(current)]
            ? current
            : (Object.keys(d.files.available_placements)[0] ?? ""),
        );
        setGroup((current) =>
          d.files.option_groups?.includes(current) ? current : "",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [productId, technique]);
  function chooseProduct(id: string) {
    if (id === productId) return;
    setProductId(id);
    const p = catalog.find((p) => p.id === Number(id));
    if (p) {
      setTitle(p.title);
      setCategory(categorizeProduct(p.title));
    }
    setFiles(null);
    setVariants([]);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const sizePrices: Record<string, number> = {};
      for (const line of sizes.split("\n").filter((s) => s.trim())) {
        const [size, value] = line.split("=");
        if (!size || !value)
          throw new Error("Enter each size price as size=price");
        sizePrices[size.trim()] = Math.round(Number(value) * 100);
      }
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/lineup/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: template?.id,
          title,
          category,
          catalog_product_id: Number(productId),
          retail_price_cents: Math.round(Number(price) * 100),
          size_prices: sizePrices,
          technique,
          placement,
          scale: scale / 100,
          option_groups: group ? [group] : [],
          active: data.get("active") === "on",
          description: template?.description ?? "",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }
  const selectClass = "w-full rounded-md border bg-background p-2 text-sm";
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {template ? "Edit template" : "Add a product template"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {catalogLoading ? <p role="status">Loading Printful products…</p> : (
            <CatalogPicker products={catalog} selectedId={productId} onSelect={chooseProduct} />
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm space-y-1">
              Product title
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1">
              Category
              <Input
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm space-y-1">
              Retail price ($)
              <Input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <div className="text-sm self-end">
              <Button
                type="button"
                variant="outline"
                disabled={!variants.length}
                onClick={() => {
                  const costs = variants
                    .map((v) => Math.round(Number(v.price) * 100))
                    .filter((v) => v > 0);
                  if (costs.length)
                    setPrice(
                      (
                        retailPrice(
                          Math.min(...costs),
                          category === "Stickers & Patches",
                        ) / 100
                      ).toFixed(2),
                    );
                }}
              >
                Calculate default price
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Uses the lowest catalog cost. You can override it.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm space-y-1">
              Decoration
              <select
                className={selectClass}
                value={technique}
                onChange={(e) => setTechnique(e.target.value)}
              >
                <option value="dtg">Print (default technique)</option>
                <option value="embroidery">Embroidery</option>
                <option value="sublimation">
                  Sublimation (default technique)
                </option>
              </select>
            </label>
            <label className="text-sm space-y-1">
              Logo placement
              <select
                required
                className={selectClass}
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
              >
                {technique === "dtg" && files?.available_placements.front && (
                  <option value={leftChestPlacement}>Left chest (front print preset)</option>
                )}
                {Object.entries(files?.available_placements ?? {}).map(
                  ([key, name]) => (
                    <option key={key} value={key}>
                      {name}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm space-y-1">
              {placement === leftChestPlacement ? "Logo scale (% of chest area)" : "Logo scale (%)"}
              <Input
                type="number"
                min="1"
                max="100"
                required
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="block text-sm space-y-1">
            Mockup style
            <select
              className={selectClass}
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">Printful default</option>
              {files?.option_groups?.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm space-y-1">
            Size-specific retail prices (optional)
            <textarea
              className={selectClass}
              rows={4}
              value={sizes}
              onChange={(e) => setSizes(e.target.value)}
              placeholder={"3x3=6.00\n4x4=7.00"}
            />
            <span className="text-xs text-muted-foreground">
              One size=price per line. Leave empty for one price across all
              sizes.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="active"
              type="checkbox"
              defaultChecked={template?.active ?? true}
            />
            Active — automatically add to stores with logos
          </label>
          {loading && (
            <p role="status" className="text-sm">
              Loading available placements…
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || loading || !files}>
              {busy ? "Saving…" : "Save template"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
