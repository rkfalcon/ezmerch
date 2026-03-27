"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";
import { CartSheet } from "./cart-sheet";

interface StoreHeaderProps {
  store: {
    name: string;
    slug: string;
    brand_colors: { primary: string };
    logo_url: string | null;
  };
}

export function StoreHeader({ store }: StoreHeaderProps) {
  const { totalItems } = useCart();

  return (
    <header className="border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link
          href={`/${store.slug}`}
          className="flex items-center gap-3"
        >
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: store.brand_colors.primary }}
            >
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-lg font-bold">{store.name}</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href={`/${store.slug}/products`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Products
          </Link>
          <CartSheet storeSlug={store.slug}>
            <button className="relative text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cart
              {totalItems > 0 && (
                <span
                  className="absolute -top-2 -right-3 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: store.brand_colors.primary }}
                >
                  {totalItems}
                </span>
              )}
            </button>
          </CartSheet>
        </div>
      </div>
    </header>
  );
}
