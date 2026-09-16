import Link from "next/link";
import { enabledVariants } from "@/lib/product-colors";
import { Card, CardContent, CardFooter } from "@/components/ui/card";

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    thumbnail_url: string | null;
    variants:
      | Array<{
          retail_price: string;
          color?: string | null;
          image_url?: string;
        }>
      | string;
    enabled_colors?: string[] | null;
    global_enabled_colors?: string[] | null;
  };
  storeSlug: string;
}

export function ProductCard({ product, storeSlug }: ProductCardProps) {
  const allVariants: Array<{
    retail_price: string;
    color?: string | null;
    image_url?: string;
  }> =
    typeof product.variants === "string"
      ? JSON.parse(product.variants)
      : product.variants;
  const variants = enabledVariants(
    allVariants,
    product.enabled_colors,
    product.global_enabled_colors,
  );
  if (!variants.length) return null;
  const thumbnail =
    variants.find((v) => v.image_url)?.image_url ?? product.thumbnail_url;

  const prices = variants
    .map((v: { retail_price: string }) => parseFloat(v.retail_price))
    .filter((p: number) => !isNaN(p));

  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;

  const priceDisplay =
    minPrice === maxPrice
      ? `$${minPrice.toFixed(2)}`
      : `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`;

  return (
    <Link href={`/${storeSlug}/products/${product.id}`}>
      <Card className="overflow-hidden transition-shadow hover:shadow-md h-full">
        <div className="aspect-square bg-muted flex items-center justify-center">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={product.title}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-4xl text-muted-foreground">
              {product.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <CardContent className="pt-4">
          <h3 className="font-medium truncate">{product.title}</h3>
        </CardContent>
        <CardFooter>
          <p className="text-sm font-semibold">{priceDisplay}</p>
        </CardFooter>
      </Card>
    </Link>
  );
}
