"use client";

import Link from "next/link";
import { useCart } from "./cart-provider";
import { CartSheet } from "./cart-sheet";

interface StoreHeaderProps {
  store: {
    header_color?: string | null;
    header_text_color?: string | null;
    name: string;
    slug: string;
    brand_colors: { primary: string };
    logo_url: string | null;
  };
}

export function StoreHeader({ store }: StoreHeaderProps) {
  const { totalItems } = useCart();

  return (
    <header
      className="border-b"
      style={{
        backgroundColor: store.header_color ?? "#ffffff",
        color: store.header_text_color ?? "#000000",
      }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href={`/${store.slug}`} className="flex items-center gap-3">
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
          <a
            href={`/${store.slug}#products`}
            className="text-sm text-inherit hover:underline"
          >
            Products
          </a>
          <CartSheet storeSlug={store.slug}>
            <button className="relative text-sm text-inherit hover:underline">
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
