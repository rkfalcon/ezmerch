import type { SupplierStock } from "../supplier-stock";
export interface ProductTemplate {
  supplier_stock?: SupplierStock | null;
  stock_check_error?: string | null;
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  catalog_product_id: number | null;
  catalog_match: string;
  retail_price_cents: number;
  size_prices: Record<string, number>;
  placement: string;
  technique: string;
  scale: number;
  option_groups: string[];
  active: boolean;
  enabled_colors?: string[] | null;
}
export interface CatalogVariant {
  image?: string;
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  price: string;
  in_stock: boolean;
  availability_status?: { region: string; status: string }[];
}
export interface CatalogProduct {
  id: number;
  title: string;
  model: string;
  brand: string;
  image: string;
  is_discontinued: boolean;
  files?: { id: string; type: string; title: string }[];
}
export interface Printfile {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
}
export interface Printfiles {
  available_placements: Record<string, string>;
  printfiles: Printfile[];
  variant_printfiles: {
    variant_id: number;
    placements: Record<string, number>;
  }[];
  option_groups?: string[];
}
export interface MockupImage {
  url: string;
  variant_ids: number[];
}
export interface MockupBatch {
  variantIds: number[];
  printfile: Printfile;
  artworkUrl?: string;
  taskKey?: string;
  taskStartedAt?: string;
  images?: MockupImage[];
  downloadedImages?: MockupImage[];
}
export interface GenerationState {
  previewPlanned?: boolean;
  productId?: number;
  variants?: CatalogVariant[];
  batches?: MockupBatch[];
  syncId?: number;
  syncProducts?: {
    sync_product: { id: number };
    sync_variants: { id: number; variant_id: number; synced: boolean }[];
  }[];
}
export interface GenerationJob {
  generation_id?: string | null;
  id: string;
  store_id: string;
  template_id: string;
  template_snapshot: ProductTemplate;
  logo_path: string;
  publish_on_complete: boolean;
  status: string;
  state: GenerationState;
  attempts: number;
  lease_token: string;
}
export interface StoredVariant {
  variant_id: number;
  sync_variant_id: number;
  name: string;
  size: string;
  color: string;
  retail_price: string;
  image_url: string;
}
