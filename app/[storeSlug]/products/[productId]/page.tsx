"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/components/storefront/cart-provider";
import { createClient } from "@/lib/supabase/client";

interface Variant {
  variant_id: number;
  name: string;
  size: string;
  color: string;
  retail_price: string;
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
  const [added, setAdded] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("products")
        .select("id, title, description, thumbnail_url, variants")
        .eq("id", productId)
        .eq("published", true)
        .single();

      if (data) {
        const variants =
          typeof data.variants === "string"
            ? JSON.parse(data.variants)
            : data.variants;
        const p = { ...data, variants } as Product;
        setProduct(p);
        if (variants.length > 0) setSelectedVariant(variants[0]);
      }
    }
    load();
  }, [productId]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  function handleAddToCart() {
    if (!selectedVariant || !product) return;
    addItem({
      productId: product.id,
      variantKey: `${selectedVariant.variant_id}`,
      title: product.title,
      variantName: selectedVariant.name,
      priceCents: Math.round(parseFloat(selectedVariant.retail_price) * 100),
      thumbnailUrl: product.thumbnail_url ?? undefined,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image */}
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center overflow-hidden">
          {product.thumbnail_url ? (
            <img
              src={product.thumbnail_url}
              alt={product.title}
              className="h-full w-full object-cover"
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

          {/* Variant Selector */}
          {product.variants.length > 1 && (
            <div className="mt-6">
              <p className="text-sm font-medium mb-2">Select Variant</p>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.variant_id}
                    onClick={() => setSelectedVariant(v)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={
                        selectedVariant?.variant_id === v.variant_id
                          ? "default"
                          : "outline"
                      }
                      className="cursor-pointer px-3 py-1"
                    >
                      {v.size} / {v.color}
                    </Badge>
                  </button>
                ))}
              </div>
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
