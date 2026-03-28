import type {
  PrintfulCatalogProduct,
  PrintfulCatalogVariant,
  PrintfulSyncProduct,
  PrintfulSyncVariant,
  PrintfulOrder,
  PrintfulShippingRate,
  PrintfulRecipient,
} from "./printful-types";

const PRINTFUL_API = "https://api.printful.com";
const PRINTFUL_TOKEN = process.env.PRINTFUL_API_TOKEN!;
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID!;

class PrintfulRateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;
  private readonly maxConcurrent = 10;
  private readonly intervalMs = 500; // ~120 req/min

  async acquire(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      this.running++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release(): void {
    this.running--;
    setTimeout(() => {
      const next = this.queue.shift();
      if (next) next();
    }, this.intervalMs);
  }
}

const rateLimiter = new PrintfulRateLimiter();

async function printfulFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  await rateLimiter.acquire();

  try {
    const response = await fetch(`${PRINTFUL_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${PRINTFUL_TOKEN}`,
        "Content-Type": "application/json",
        "X-PF-Store-Id": PRINTFUL_STORE_ID,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Printful API error ${response.status}: ${errorBody}`
      );
    }

    const json = await response.json();
    return json.result as T;
  } finally {
    rateLimiter.release();
  }
}

// V2 API helper (different path prefix)
async function printfulFetchV2<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  await rateLimiter.acquire();

  try {
    const response = await fetch(`${PRINTFUL_API}/v2${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${PRINTFUL_TOKEN}`,
        "Content-Type": "application/json",
        "X-PF-Store-Id": PRINTFUL_STORE_ID,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Printful API v2 error ${response.status}: ${errorBody}`
      );
    }

    const json = await response.json();
    return json.data ?? json.result ?? json;
  } finally {
    rateLimiter.release();
  }
}

// ============================================================
// Mockup Generator v2
// ============================================================

export interface MockupTemplate {
  template_id: number;
  image_url: string;
  background_url: string;
  background_color: string | null;
  printfile_id: number;
  template_width: number;
  template_height: number;
  print_area_width: number;
  print_area_height: number;
  print_area_top: number;
  print_area_left: number;
  is_template_on_front: boolean;
  orientation: string;
}

export interface MockupPrintfile {
  printfile_id: number;
  width: number;
  height: number;
  dpi: number;
  fill_mode: string;
  can_rotate: boolean;
}

export interface MockupTaskResult {
  task_key: string;
  status: string;
  mockups?: Array<{
    placement: string;
    variant_ids: number[];
    mockup_url: string;
    extra: Array<{
      title: string;
      url: string;
    }>;
  }>;
  error?: string;
}

export async function getMockupTemplates(
  productId: number
): Promise<{ variant_mapping: Array<{ variant_id: number; templates: MockupTemplate[] }>; templates: MockupTemplate[] }> {
  return printfulFetchV2(`/mockup-generator/templates/${productId}`);
}

export async function getMockupPrintfiles(
  productId: number
): Promise<{ available_placements: Record<string, { printfiles: MockupPrintfile[] }> }> {
  return printfulFetchV2(`/mockup-generator/printfiles/${productId}`);
}

export async function createMockupTask(
  productId: number,
  data: {
    variant_ids: number[];
    format: string;
    files: Array<{
      placement: string;
      image_url: string;
      position?: {
        area_width: number;
        area_height: number;
        width: number;
        height: number;
        top: number;
        left: number;
      };
    }>;
  }
): Promise<{ task_key: string }> {
  return printfulFetchV2(`/mockup-generator/create-task/${productId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMockupTaskResult(
  taskKey: string
): Promise<MockupTaskResult> {
  return printfulFetchV2(`/mockup-generator/task?task_key=${taskKey}`);
}

// ============================================================
// Catalog
// ============================================================

export async function getCatalogProducts(): Promise<PrintfulCatalogProduct[]> {
  return printfulFetch<PrintfulCatalogProduct[]>("/products");
}

export async function getCatalogProduct(
  productId: number
): Promise<{ product: PrintfulCatalogProduct; variants: PrintfulCatalogVariant[] }> {
  return printfulFetch(`/products/${productId}`);
}

// ============================================================
// Sync Products (store products)
// ============================================================

export async function createSyncProduct(data: {
  sync_product: { name: string; thumbnail?: string };
  sync_variants: Array<{
    variant_id: number;
    retail_price: string;
    files: Array<{ url: string; type?: string }>;
  }>;
}): Promise<PrintfulSyncProduct> {
  return printfulFetch<PrintfulSyncProduct>("/store/products", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getSyncProducts(): Promise<PrintfulSyncProduct[]> {
  return printfulFetch<PrintfulSyncProduct[]>("/store/products");
}

export async function getSyncProduct(
  syncProductId: number
): Promise<{ sync_product: PrintfulSyncProduct; sync_variants: PrintfulSyncVariant[] }> {
  return printfulFetch(`/store/products/${syncProductId}`);
}

export async function deleteSyncProduct(syncProductId: number): Promise<void> {
  await printfulFetch(`/store/products/${syncProductId}`, {
    method: "DELETE",
  });
}

// ============================================================
// Shipping Rates
// ============================================================

export async function getShippingRates(data: {
  recipient: Pick<PrintfulRecipient, "address1" | "city" | "state_code" | "country_code" | "zip">;
  items: Array<{ variant_id: number; quantity: number }>;
}): Promise<PrintfulShippingRate[]> {
  return printfulFetch<PrintfulShippingRate[]>("/shipping/rates", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ============================================================
// Orders
// ============================================================

export async function createOrder(data: {
  external_id: string;
  recipient: PrintfulRecipient;
  items: Array<{
    sync_variant_id: number;
    quantity: number;
  }>;
}): Promise<PrintfulOrder> {
  // Create as draft (not charged yet)
  return printfulFetch<PrintfulOrder>("/orders", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function confirmOrder(orderId: number): Promise<PrintfulOrder> {
  // Confirm the order — Printful charges at this point
  return printfulFetch<PrintfulOrder>(`/orders/${orderId}/confirm`, {
    method: "POST",
  });
}

export async function getOrder(orderId: number): Promise<PrintfulOrder> {
  return printfulFetch<PrintfulOrder>(`/orders/${orderId}`);
}

export async function getOrderByExternalId(
  externalId: string
): Promise<PrintfulOrder> {
  return printfulFetch<PrintfulOrder>(`/orders/@${externalId}`);
}
