"use client";

import { ScrollDiagnostics } from "./scroll-diagnostics";
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
    website_url?: string | null;
  };
}

export function StoreHeader({ store }: StoreHeaderProps) {
  const { totalItems } = useCart();

  return (
    <>
    <div aria-hidden="true" className="h-[65px] shrink-0" />
    <header
      className="fixed inset-x-0 top-0 z-30 border-b bg-background text-foreground"
      style={{
        backgroundColor: store.header_color ?? undefined,
        color: store.header_text_color ?? undefined,
      }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between gap-3 px-4">
        <a href={store.website_url && /^https?:\/\//i.test(store.website_url) ? store.website_url : `/${store.slug}`} className="flex min-w-0 items-center gap-2 sm:gap-3">
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: store.brand_colors.primary }}
            >
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="truncate text-base font-bold sm:text-lg">{store.name}</span>
        </a>

        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
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
      <ScrollDiagnostics />
    </header>
    </>
  );
}
