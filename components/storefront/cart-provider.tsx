"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface CartItem {
  productId: string;
  variantKey: string;
  title: string;
  variantName: string;
  priceCents: number;
  quantity: number;
  thumbnailUrl?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (productId: string, variantKey: string) => void;
  updateQuantity: (productId: string, variantKey: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalCents: number;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

function getStorageKey(storeSlug: string) {
  return `ezmerch-cart-${storeSlug}`;
}

export function CartProvider({
  storeSlug,
  children,
}: {
  storeSlug: string;
  children: React.ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(getStorageKey(storeSlug));
    if (stored) {
      try {
        setItems(JSON.parse(stored));
      } catch {
        // Invalid stored data
      }
    }
  }, [storeSlug]);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem(getStorageKey(storeSlug), JSON.stringify(items));
  }, [items, storeSlug]);

  const addItem = useCallback((item: Omit<CartItem, "quantity">) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.productId === item.productId && i.variantKey === item.variantKey
      );
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId && i.variantKey === item.variantKey
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId: string, variantKey: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.variantKey === variantKey)
      )
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, variantKey: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId, variantKey);
        return;
      }
      setItems((prev) =>
        prev.map((i) =>
          i.productId === productId && i.variantKey === variantKey
            ? { ...i, quantity }
            : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalCents = items.reduce(
    (sum, i) => sum + i.priceCents * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalCents,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
