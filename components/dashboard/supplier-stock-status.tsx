import type { SupplierStock } from "@/lib/supplier-stock";
export function SupplierStockStatus({
  stock,
  error,
}: {
  stock?: SupplierStock | null;
  error?: string | null;
}) {
  return (
    <p className="text-xs text-amber-800" role="status">
      {error
        ? "Printful stock check delayed; keeping the last confirmed status."
        : !stock
          ? "Printful stock check pending."
          : stock.discontinued
            ? "Discontinued by Printful — purchases blocked."
            : stock.unavailable.length
              ? `${stock.unavailable.length} size/color variants unavailable from Printful for US delivery. Purchases of these variants are blocked.`
              : "Printful stock checked · available for US delivery."}
    </p>
  );
}
