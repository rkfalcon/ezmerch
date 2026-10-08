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
        ? "Stock check delayed; keeping the last confirmed status."
        : !stock
          ? "Stock check pending."
          : stock.discontinued
            ? "Discontinued — purchases blocked."
            : stock.unavailable.length
              ? `${stock.unavailable.length} size/color variants unavailable for US delivery. Purchases of these variants are blocked.`
              : "Stock checked · available for US delivery."}
    </p>
  );
}
