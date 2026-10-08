"use client";
import { productTitle } from "@/lib/product-title";


import Link from "next/link";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button, buttonVariants } from "@/components/ui/button";
import { useCart } from "./cart-provider";

export function CartSheet({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { items, removeItem, updateQuantity, totalCents } = useCart();

  // Keep the document scroll container stable when iOS browser chrome changes.
  return (
    <Sheet modal="trap-focus" open={open} onOpenChange={setOpen}>
      <SheetTrigger render={children as React.ReactElement}>{}</SheetTrigger>
      <SheetContent className="overscroll-contain">
        <SheetHeader>
          <SheetTitle>Shopping Cart</SheetTitle>
          <SheetDescription>
            {items.length === 0
              ? "Your cart is empty"
              : `${items.length} item${items.length > 1 ? "s" : ""} in your cart`}
          </SheetDescription>
        </SheetHeader>

        {items.length > 0 && (
          <div className="mt-6 flex min-h-0 flex-col gap-4 flex-1">
            <div className="space-y-4 min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantKey}`}
                  className="flex gap-3 border-b pb-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{productTitle(item.title)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantName}
                    </p>
                    <p className="text-sm mt-1">
                      ${(item.priceCents / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          item.variantKey,
                          item.quantity - 1,
                        )
                      }
                    >
                      -
                    </Button>
                    <span className="text-sm w-6 text-center">
                      {item.quantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon-xs"
                      onClick={() =>
                        updateQuantity(
                          item.productId,
                          item.variantKey,
                          item.quantity + 1,
                        )
                      }
                    >
                      +
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() =>
                        removeItem(item.productId, item.variantKey)
                      }
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t pt-4">
              <div className="flex justify-between text-sm font-medium mb-4">
                <span>Subtotal</span>
                <span>${(totalCents / 100).toFixed(2)}</span>
              </div>
              <Link
                href={`/${storeSlug}/checkout`}
                onClick={() => setOpen(false)}
                className={buttonVariants({ className: "w-full" })}
              >
                Checkout
              </Link>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
