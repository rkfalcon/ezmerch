"use client";

import { useState, useMemo } from "react";
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
import { categorizeProduct, getCategoryList } from "@/lib/printful-categories";
import { MockupPreview } from "./mockup-preview";
import { createClient } from "@/lib/supabase/client";

interface CatalogProduct {
  id: number;
  title: string;
  image: string;
  category?: string;
}

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
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [designUrl, setDesignUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [designFileName, setDesignFileName] = useState<string | null>(null);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [productPrices, setProductPrices] = useState<Record<number, { min: number; max: number }>>({});

  // Group products by category
  const categorizedProducts = useMemo(() => {
    const grouped: Record<string, CatalogProduct[]> = {};
    for (const p of catalogProducts) {
      const cat = p.category || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    }
    return grouped;
  }, [catalogProducts]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of catalogProducts) {
      const cat = p.category || "Other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [catalogProducts]);

  // Sorted categories (by count descending, "Other" last)
  const sortedCategories = useMemo(() => {
    return getCategoryList()
      .filter((cat) => categoryCounts[cat])
      .sort((a, b) => {
        if (a === "Other") return 1;
        if (b === "Other") return -1;
        return (categoryCounts[b] || 0) - (categoryCounts[a] || 0);
      });
  }, [categoryCounts]);

  async function loadCatalog() {
    setLoadingCatalog(true);
    try {
      const res = await fetch("/api/printful/catalog");
      const data = await res.json();
      if (Array.isArray(data)) {
        const withCategories = data.map((p: { id: number; title: string; image: string }) => ({
          ...p,
          category: categorizeProduct(p.title),
        }));
        setCatalogProducts(withCategories);
      }
    } catch {
      setError("Failed to load Printful catalog");
    }
    setLoadingCatalog(false);
  }

  async function selectCategory(category: string) {
    setSelectedCategory(category);
    // Fetch prices for products in this category
    const products = categorizedProducts[category];
    if (!products) return;
    const idsToFetch = products
      .map((p) => p.id)
      .filter((id) => !productPrices[id]);
    if (idsToFetch.length > 0) {
      setLoadingPrices(true);
      try {
        const res = await fetch("/api/printful/catalog/prices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productIds: idsToFetch }),
        });
        const prices = await res.json();
        setProductPrices((prev) => ({ ...prev, ...prices }));
      } catch {
        // Prices are optional — continue without them
      }
      setLoadingPrices(false);
    }
  }

  // Products in selected category sorted by min price
  const sortedCategoryProducts = useMemo(() => {
    if (!selectedCategory || !categorizedProducts[selectedCategory]) return [];
    return [...categorizedProducts[selectedCategory]].sort((a, b) => {
      const priceA = productPrices[a.id]?.min ?? Infinity;
      const priceB = productPrices[b.id]?.min ?? Infinity;
      return priceA - priceB;
    });
  }, [selectedCategory, categorizedProducts, productPrices]);

  async function selectCatalogProduct(productId: number, title: string) {
    setSelectedProduct({ id: productId, title });
    setSelectedCategory(null);
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
          ) : catalogProducts.length === 0 ? (
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
          ) : selectedCategory ? (
            /* Show products in selected category */
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  &larr; Back to categories
                </Button>
                <h3 className="font-medium">{selectedCategory}</h3>
                <Badge variant="secondary">
                  {categorizedProducts[selectedCategory]?.length ?? 0} products
                </Badge>
              </div>
              {loadingPrices && (
                <p className="text-sm text-muted-foreground mb-3">Loading prices...</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto">
                {sortedCategoryProducts.map((p) => {
                  const price = productPrices[p.id];
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectCatalogProduct(p.id, p.title)}
                      className="rounded-md border p-3 text-left hover:bg-muted transition-colors flex items-center gap-3"
                    >
                      {p.image ? (
                        <img
                          src={p.image}
                          alt={p.title}
                          className="h-12 w-12 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded bg-muted flex items-center justify-center flex-shrink-0 text-xs text-muted-foreground">
                          N/A
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.title}</p>
                        {price ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {price.min === price.max
                              ? `$${price.min.toFixed(2)}`
                              : `$${price.min.toFixed(2)} – $${price.max.toFixed(2)}`}
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {loadingPrices ? "..." : "Price varies"}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Show category grid */
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Choose a product category
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {sortedCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => selectCategory(cat)}
                    className="rounded-md border p-4 text-left hover:bg-muted transition-colors"
                  >
                    <p className="font-medium text-sm">{cat}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {categoryCounts[cat]} product{categoryCounts[cat] !== 1 ? "s" : ""}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Design File */}
      <Card>
        <CardHeader>
          <CardTitle>Design</CardTitle>
          <CardDescription>
            Upload your logo or design image
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {designUrl ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <img
                  src={designUrl}
                  alt="Design preview"
                  className="h-24 w-24 rounded-md border object-contain bg-muted p-1"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {designFileName || "Design uploaded"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {designUrl}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setDesignUrl("");
                      setDesignFileName(null);
                    }}
                  >
                    Remove & upload new
                  </Button>
                </div>
              </div>
              <input type="hidden" name="designFileUrl" value={designUrl} />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="designUpload">Upload Image</Label>
                <Input
                  id="designUpload"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  disabled={uploading}
                  className="mt-1"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file size (max 20MB)
                    if (file.size > 20 * 1024 * 1024) {
                      setError("File size must be under 20MB");
                      return;
                    }

                    setUploading(true);
                    setError(null);

                    try {
                      const supabase = createClient();
                      const ext = file.name.split(".").pop() || "png";
                      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                      const filePath = `${storeId}/${fileName}`;

                      const { error: uploadError } = await supabase.storage
                        .from("designs")
                        .upload(filePath, file, {
                          contentType: file.type,
                          upsert: false,
                        });

                      if (uploadError) {
                        setError(`Upload failed: ${uploadError.message}`);
                        setUploading(false);
                        return;
                      }

                      const { data: urlData } = supabase.storage
                        .from("designs")
                        .getPublicUrl(filePath);

                      setDesignUrl(urlData.publicUrl);
                      setDesignFileName(file.name);
                    } catch {
                      setError("Failed to upload design file");
                    }
                    setUploading(false);
                  }}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG, SVG, or WebP — max 20MB. For best mockup results,
                  use high-resolution images (at least 1800x2400 px / 300 DPI).
                </p>
              </div>

              {uploading && (
                <p className="text-sm text-muted-foreground">Uploading...</p>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    or paste a URL
                  </span>
                </div>
              </div>

              <Input
                type="url"
                placeholder="https://example.com/design.png"
                onChange={(e) => {
                  if (e.target.value) {
                    setDesignUrl(e.target.value);
                    setDesignFileName(null);
                  }
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Mockup Preview */}
      {selectedProduct && (
        <MockupPreview
          productId={selectedProduct.id}
          designUrl={designUrl}
          variantIds={variants.map((v) => v.variant_id)}
        />
      )}

      {/* Section 4: Product Details */}
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
