"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { colorName, type ColorVariant } from "@/lib/product-colors";

interface ProductSummary {
  id: string;
  title: string;
  thumbnail_url: string | null;
}
interface Details extends ProductSummary {
  variants: ColorVariant[];
  enabled_colors: string[] | null;
  global_active?: boolean;
  global_enabled_colors?: string[] | null;
  preview_source?: "sample" | "catalog";
}

export function ProductColorPreview({
  product,
  scope = "store",
}: {
  product: ProductSummary;
  scope?: "store" | "global";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 text-left rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-4"
        aria-label={`View ${product.title} and manage colors`}
      >
        {product.thumbnail_url && (
          <img
            src={product.thumbnail_url}
            alt=""
            className="h-20 w-20 shrink-0 rounded object-contain"
          />
        )}
        <span>
          <span className="block font-medium">{product.title}</span>
          <span className="block mt-1 text-xs text-muted-foreground">
            View mockup & colors
          </span>
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader className="pr-8">
            <DialogTitle>{product.title}</DialogTitle>
            <DialogDescription>
              {scope === "global"
                ? "Sample logo preview. These color settings apply to every store."
                : "Preview each color, then choose which colors customers can buy in this store."}{" "}
              All available sizes for enabled colors stay available.
            </DialogDescription>
          </DialogHeader>
          {open && <ColorEditor product={product} scope={scope} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ColorEditor({
  product,
  scope,
}: {
  product: ProductSummary;
  scope: "store" | "global";
}) {
  const router = useRouter();
  const endpoint =
    scope === "global"
      ? `/api/lineup/templates/${product.id}/colors`
      : `/api/products/${product.id}/colors`;
  const [details, setDetails] = useState<Details | null>(null);
  const [selected, setSelected] = useState("");
  const [enabled, setEnabled] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "Could not load colors");
        if (controller.signal.aborted) return;
        const colors = [
          ...new Set((data.variants as ColorVariant[]).map(colorName)),
        ];
        setDetails(data);
        setSelected(colors[0] ?? "");
        setEnabled(data.enabled_colors ?? colors);
        setSaved(data.enabled_colors ?? colors);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [endpoint]);
  const colors = details ? [...new Set(details.variants.map(colorName))] : [];
  const globallyAllowed = (color: string) =>
    scope === "global" ||
    (details?.global_active !== false &&
      (details?.global_enabled_colors == null ||
        details.global_enabled_colors.includes(color)));
  const colorVariants =
    details?.variants.filter((v) => colorName(v) === selected) ?? [];
  const image = colorVariants.find((v) => v.image_url)?.image_url;
  const dirty =
    enabled.length !== saved.length || enabled.some((c) => !saved.includes(c));
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ colors: enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save colors");
      setSaved(data.colors);
      setNotice(
        scope === "global"
          ? "Global color availability saved for all stores."
          : "Color availability saved.",
      );
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save colors");
    } finally {
      setBusy(false);
    }
  }
  if (!details)
    return (
      <p role={error ? "alert" : "status"} className="py-8">
        {error || "Loading product colors…"}
      </p>
    );
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div>
        {scope === "global" && (
          <p className="mb-2 text-sm text-muted-foreground">
            {details.preview_source === "sample"
              ? "Sample logo from a generated store product. Each store uses its own logo."
              : "Catalog image. A sample logo mockup will appear after a store generates this product."}
          </p>
        )}
        {details.global_active === false && (
          <p className="mb-2 text-sm">
            This product is disabled globally. Your store choices are preserved.
          </p>
        )}
        <div className="aspect-square rounded-lg border bg-white flex items-center justify-center overflow-hidden">
          {image ? (
            <img
              key={image}
              src={image}
              alt={`${product.title} in ${selected}`}
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="p-6 text-center text-muted-foreground">
              {product.thumbnail_url && (
                <img
                  src={product.thumbnail_url}
                  alt={`${product.title}, general preview`}
                  className="w-full object-contain"
                />
              )}
              <p className="mt-2">
                A color-specific mockup is not available for {selected}.
              </p>
            </div>
          )}
        </div>
        <p className="mt-3 font-medium">
          {selected}
          {!globallyAllowed(selected)
            ? " · Disabled globally"
            : selected && !enabled.includes(selected)
              ? scope === "global"
                ? " · Disabled globally"
                : " · Disabled in store"
              : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          Sizes:{" "}
          {[...new Set(colorVariants.map((v) => v.size).filter(Boolean))].join(
            ", ",
          ) || "One size"}
        </p>
      </div>
      <div className="min-w-0 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Available colors</h3>
          <span className="text-sm text-muted-foreground">
            {enabled.filter(globallyAllowed).length} of {colors.length} enabled
          </span>
        </div>
        <label className="block text-sm">
          Find a color
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2"
            placeholder="Search colors…"
          />
        </label>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              setEnabled([
                ...new Set([...enabled, ...colors.filter(globallyAllowed)]),
              ])
            }
          >
            Enable all
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() =>
              setEnabled(enabled.filter((c) => !globallyAllowed(c)))
            }
          >
            Clear selection
          </Button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
          {colors
            .filter((c) => c.toLowerCase().includes(search.toLowerCase()))
            .map((color) => (
              <div
                key={color}
                className={`flex items-center gap-3 p-2 ${color === selected ? "bg-muted" : ""}`}
              >
                <input
                  type="checkbox"
                  aria-label={`Enable ${color}`}
                  checked={enabled.includes(color)}
                  disabled={busy || !globallyAllowed(color)}
                  onChange={(e) => {
                    setNotice("");
                    setEnabled((current) =>
                      e.target.checked
                        ? [...current, color]
                        : current.filter((c) => c !== color),
                    );
                  }}
                  className="h-4 w-4 shrink-0"
                />
                <button
                  type="button"
                  aria-pressed={color === selected}
                  onClick={() => setSelected(color)}
                  className="flex-1 py-1 text-left rounded focus-visible:outline-2"
                >
                  {color}
                  {!globallyAllowed(color) && (
                    <span className="block text-xs text-muted-foreground">
                      Disabled globally · store preference saved
                    </span>
                  )}
                  <span className="float-right text-xs text-muted-foreground">
                    Preview
                  </span>
                </button>
              </div>
            ))}
        </div>
        {!enabled.length && (
          <p className="text-sm text-muted-foreground">
            Choose at least one color, or hide the product using its visibility
            control.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="text-sm">
            {notice}
          </p>
        )}
        <Button
          type="button"
          disabled={busy || !dirty || !enabled.length}
          onClick={save}
          className="w-full"
        >
          {busy ? "Saving…" : "Save enabled colors"}
        </Button>
        {dirty && (
          <p className="text-xs text-muted-foreground">
            You have unsaved changes.
          </p>
        )}
      </div>
    </div>
  );
}
