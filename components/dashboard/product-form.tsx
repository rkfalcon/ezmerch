"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createProduct } from "@/app/actions/products";

interface Variant {
  variant_id: number;
  name: string;
  size: string;
  color: string;
  retail_price: string;
  base_cost: string;
}

interface ProductFormProps {
  storeId: string;
  returnPath: string;
}

export function ProductForm({ storeId, returnPath }: ProductFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Catalog selection state
  const [catalogProducts, setCatalogProducts] = useState<
    Array<{ id: number; title: string; image: string }>
  >([]);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const res = await fetch("/api/printful/catalog");
      const data = await res.json();
      if (Array.isArray(data)) {
        setCatalogProducts(data.slice(0, 50)); // Show first 50
      }
    } catch {
      setError("Failed to load Printful catalog");
    }
    setLoadingCatalog(false);
  }

  async function selectCatalogProduct(productId: number, title: string) {
    setSelectedProduct({ id: productId, title });
    setLoadingVariants(true);
    try {
      const res = await fetch(`/api/printful/catalog?productId=${productId}`);
      const data = await res.json();
      if (data.variants) {
        setVariants(
          data.variants
            .filter((v: { in_stock: boolean }) => v.in_stock)
            .slice(0, 20)
            .map((v: { id: number; name: string; size: string; color: string; price: string }) => ({
              variant_id: v.id,
              name: v.name,
              size: v.size,
              color: v.color,
              retail_price: "",
              base_cost: v.price,
            }))
        );
      }
    } catch {
      setError("Failed to load variants");
    }
    setLoadingVariants(false);
  }

  function updateVariantPrice(index: number, price: string) {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, retail_price: price } : v))
    );
  }

  function removeVariant(index: number) {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    // Validate prices exceed base cost
    const invalidVariants = variants.filter(
      (v) =>
        v.retail_price &&
        parseFloat(v.retail_price) <= parseFloat(v.base_cost)
    );

    if (invalidVariants.length > 0) {
      setError(
        `Retail price must exceed the Printful base cost for all variants. Check: ${invalidVariants.map((v) => v.name).join(", ")}`
      );
      setPending(false);
      return;
    }

    const activeVariants = variants.filter((v) => v.retail_price);
    if (activeVariants.length === 0) {
      setError("Set a retail price for at least one variant");
      setPending(false);
      return;
    }

    formData.set("storeId", storeId);
    formData.set("variants", JSON.stringify(activeVariants));

    const result = await createProduct(formData);
    if (result.error) {
      setError(result.error);
      setPending(false);
    } else {
      router.push(returnPath);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6 max-w-3xl">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Section 1: Base Product Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Base Product</CardTitle>
          <CardDescription>
            Select a product from the Printful catalog
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedProduct ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedProduct.title}</p>
                <p className="text-sm text-muted-foreground">
                  Printful ID: {selectedProduct.id}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProduct(null);
                  setVariants([]);
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            <div>
              {catalogProducts.length === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={loadCatalog}
                  disabled={loadingCatalog}
                >
                  {loadingCatalog
                    ? "Loading catalog..."
                    : "Browse Printful Catalog"}
                </Button>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                  {catalogProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectCatalogProduct(p.id, p.title)}
                      className="rounded-md border p-3 text-left hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium truncate">{p.title}</p>
                      <p className="text-xs text-muted-foreground">ID: {p.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Design File */}
      <Card>
        <CardHeader>
          <CardTitle>Design</CardTitle>
          <CardDescription>
            Upload your logo or design file URL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="designFileUrl">Design File URL</Label>
            <Input
              id="designFileUrl"
              name="designFileUrl"
              type="url"
              placeholder="https://example.com/design.png"
            />
            <p className="text-xs text-muted-foreground">
              Provide a direct URL to your design file (PNG, JPG, or SVG)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Product Details */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Name and description for the storefront</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Product Title</Label>
            <Input
              id="title"
              name="title"
              placeholder="Custom Logo T-Shirt"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="A comfortable t-shirt featuring your custom logo..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Variants & Pricing */}
      {variants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Variants & Pricing</CardTitle>
            <CardDescription>
              Set retail prices for each variant. Price must exceed the Printful
              base cost.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingVariants ? (
              <p className="text-muted-foreground">Loading variants...</p>
            ) : (
              <div className="space-y-3">
                {variants.map((v, i) => (
                  <div
                    key={v.variant_id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.name}</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{v.size}</Badge>
                        <Badge variant="outline">{v.color}</Badge>
                        <span className="text-xs text-muted-foreground">
                          Base: ${v.base_cost}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min={parseFloat(v.base_cost) + 0.01}
                        placeholder={`Min $${(parseFloat(v.base_cost) + 1).toFixed(2)}`}
                        value={v.retail_price}
                        onChange={(e) => updateVariantPrice(i, e.target.value)}
                        className="w-28"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVariant(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || variants.length === 0}>
          {pending ? "Creating..." : "Create Product"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(returnPath)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
