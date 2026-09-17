"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/storefront/cart-provider";
import { createClient } from "@/lib/supabase/client";
import {
  colorName,
  enabledVariants,
  defaultVariant,
} from "@/lib/product-colors";

interface Variant {
  variant_id: number;
  name: string;
  size: string;
  color: string;
  retail_price: string;
  image_url?: string;
}

interface Product {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  variants: Variant[];
}

export default function ProductDetailPage() {
  const params = useParams();
  const storeSlug = params.storeSlug as string;
  const productId = params.productId as string;

  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select(
          "id, title, description, thumbnail_url, variants, enabled_colors, global_enabled_colors, default_color, stores!inner(slug)",
        )
        .eq("id", productId)
        .eq("published", true)
        .eq("global_active", true)
        .eq("stores.slug", storeSlug)
        .single();

      if (cancelled) return;
      if (data) {
        const allVariants: Variant[] =
          typeof data.variants === "string"
            ? JSON.parse(data.variants)
            : data.variants;
        const variants = enabledVariants(
          allVariants,
          data.enabled_colors,
          data.global_enabled_colors,
        );
        if (!variants.length) {
          setUnavailable(true);
          setProduct(null);
          return;
        }
        setUnavailable(false);
        const p = { ...data, variants } as Product;
        setProduct(p);
        setSelectedVariant(
          defaultVariant(variants, data.default_color) ?? null,
        );
      } else {
        setUnavailable(true);
        setProduct(null);
        setSelectedVariant(null);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [productId, storeSlug]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        {unavailable ? "This product is currently unavailable." : "Loading..."}
      </div>
    );
  }

  const colors = [...new Set(product.variants.map(colorName))].sort((a, b) =>
    a.localeCompare(b),
  );
  const sizeOrder = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "2XL",
    "3XL",
    "4XL",
    "5XL",
    "6XL",
  ];
  const colorVariants = product.variants
    .filter(
      (v) => selectedVariant && colorName(v) === colorName(selectedVariant),
    )
    .sort((a, b) => {
      const first = sizeOrder.indexOf(a.size),
        second = sizeOrder.indexOf(b.size);
      return first >= 0 && second >= 0
        ? first - second
        : a.size.localeCompare(b.size, undefined, { numeric: true });
    });

  function handleAddToCart() {
    if (!selectedVariant || !product) return;
    addItem({
      productId: product.id,
      variantKey: `${selectedVariant.variant_id}`,
      title: product.title,
      variantName: selectedVariant.name,
      priceCents: Math.round(parseFloat(selectedVariant.retail_price) * 100),
      thumbnailUrl:
        selectedVariant.image_url ?? product.thumbnail_url ?? undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {selectedVariant?.image_url || product.thumbnail_url ? (
            <img
              src={selectedVariant?.image_url || product.thumbnail_url!}
              alt={product.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-6xl text-muted-foreground">
              {product.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* Details */}
        <div>
          <h1 className="text-3xl font-bold">{product.title}</h1>
          {product.description && (
            <p className="mt-3 text-muted-foreground">{product.description}</p>
          )}

          {selectedVariant && (
            <p className="mt-4 text-2xl font-bold">
              ${parseFloat(selectedVariant.retail_price).toFixed(2)}
            </p>
          )}

          {selectedVariant && (
            <div className="mt-6 grid max-w-md gap-4 sm:grid-cols-2">
              {(colors.length > 1 || colors[0] !== "Default") && (
                <label
                  className="space-y-2 text-sm font-medium"
                  htmlFor="product-color"
                >
                  <span className="block">Color</span>
                  <select
                    id="product-color"
                    value={colorName(selectedVariant)}
                    className="w-full min-w-0 rounded-md border bg-background px-3 py-2.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                    onChange={(event) => {
                      const matches = product.variants.filter(
                        (v) => colorName(v) === event.target.value,
                      );
                      setSelectedVariant(
                        matches.find((v) => v.size === selectedVariant.size) ??
                          matches[0],
                      );
                      setAdded(false);
                    }}
                  >
                    {colors.map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label
                className="space-y-2 text-sm font-medium"
                htmlFor="product-size"
              >
                <span className="block">Size</span>
                <select
                  id="product-size"
                  value={selectedVariant.variant_id}
                  className="w-full min-w-0 rounded-md border bg-background px-3 py-2.5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
                  onChange={(event) => {
                    setSelectedVariant(
                      colorVariants.find(
                        (v) => v.variant_id === Number(event.target.value),
                      ) ?? selectedVariant,
                    );
                    setAdded(false);
                  }}
                >
                  {colorVariants.map((variant) => (
                    <option key={variant.variant_id} value={variant.variant_id}>
                      {variant.size || "One size"}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <Button
            className="mt-8 w-full md:w-auto px-8"
            onClick={handleAddToCart}
            disabled={!selectedVariant}
          >
            {added ? "Added to Cart!" : "Add to Cart"}
          </Button>

          <p className="mt-4 text-xs text-muted-foreground">
            Print-on-demand items cannot be returned or exchanged. Refunds only
            for defective or damaged items.
          </p>
        </div>
      </div>
    </div>
  );
}
