import { SupplierStockStatus } from "./supplier-stock-status";
import type { SupplierStock } from "@/lib/supplier-stock";
import { colorName, enabledVariants } from "@/lib/product-colors";

export const enabledProductClass =
  "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50";
export const disabledProductClass =
  "border-rose-200 bg-rose-50/70 hover:bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30 dark:hover:bg-rose-950/50";

export function ColorAvailabilityPills({
  colors,
  productEnabled,
  enabledColors,
  globalColors,
  globalActive = true,
  scope = "store",
}: {
  colors: string[];
  productEnabled: boolean;
  enabledColors?: string[] | null;
  globalColors?: string[] | null;
  globalActive?: boolean;
  scope?: "store" | "global";
}) {
  return (
    <div className="mt-3 max-w-xl space-y-2 whitespace-normal">
      <p className="text-xs text-muted-foreground">
        Colors: ✓ Enabled · − Disabled
      </p>
      <div
        className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto"
        aria-label="Color availability"
      >
        {colors.map((color) => {
          const globallyDisabled =
            !globalActive ||
            (globalColors != null && !globalColors.includes(color));
          const locallyDisabled =
            enabledColors != null && !enabledColors.includes(color);
          const enabled =
            productEnabled && !globallyDisabled && !locallyDisabled;
          const reason = globallyDisabled
            ? "Disabled globally"
            : !productEnabled
              ? scope === "global"
                ? "Product disabled globally"
                : "Product hidden in this store"
              : locallyDisabled
                ? scope === "global"
                  ? "Disabled globally"
                  : "Disabled in this store"
                : "Enabled";
          return (
            <span
              key={color}
              title={`${color}: ${reason}`}
              aria-label={`${color}: ${reason}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${
                enabled
                  ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
              }`}
            >
              <span aria-hidden="true">{enabled ? "✓" : "−"}</span>
              <span className={enabled ? "" : "line-through"}>{color}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

type StoreProductAvailability = {
  supplier_stock?: SupplierStock | null;
  published: boolean;
  global_active?: boolean;
  enabled_colors?: string[] | null;
  global_enabled_colors?: string[] | null;
  variants: { color?: string | null }[] | string;
};

function variantsOf(
  product: StoreProductAvailability,
): { color?: string | null }[] {
  return typeof product.variants === "string"
    ? JSON.parse(product.variants)
    : product.variants;
}

export function storeProductEnabled(product: StoreProductAvailability) {
  return (
    product.published &&
    product.global_active !== false &&
    enabledVariants(
      variantsOf(product),
      product.enabled_colors,
      product.global_enabled_colors,
    ).length > 0
  );
}

export function StoreProductColorPills({
  product,
}: {
  product: StoreProductAvailability;
}) {
  return (
    <div>
      <p className="mt-2 text-xs font-medium">
        {product.global_active === false
          ? "Disabled globally"
          : !product.published
            ? "Hidden in this store"
            : !storeProductEnabled(product)
              ? "No enabled colors — hidden from storefront"
              : "Enabled in this store"}
      </p>
      <SupplierStockStatus stock={product.supplier_stock} />
      <ColorAvailabilityPills
        colors={[...new Set(variantsOf(product).map(colorName))]}
        productEnabled={product.published}
        enabledColors={product.enabled_colors}
        globalColors={product.global_enabled_colors}
        globalActive={product.global_active}
      />
    </div>
  );
}
