import { addInsideLabels } from "./inside-label-server";
import { printfulCredentials } from "../printful-connection";
import { explicitTechnique } from "./catalog-techniques";
import { printfulPlacement } from "./placement";
import type {
  CatalogProduct,
  CatalogVariant,
  MockupBatch,
  Printfiles,
  ProductTemplate,
} from "./types";

export class PrintfulError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfterMs = 65_000,
  ) {
    super(`Printful ${status}: ${message}`);
  }
}
interface SyncPayload {
  sync_product: { name: string; external_id?: string; thumbnail?: string };
  sync_variants: Array<{
    variant_id: number;
    retail_price: string;
    files: Array<{
      url: string;
      type: string;
      options?: { id: string; value: boolean | string }[];
    }>;
  }>;
}
export interface SyncResult {
  sync_product: { id: number };
  sync_variants: Array<{ id: number; variant_id: number; synced: boolean }>;
}

export function mockupQuotaCooldown(headers: Headers): number {
  if (headers.get("x-ratelimit-remaining") !== "0") return 0;
  // Live tests showed throttling after the advertised reset. Allow a full quiet
  // minute once exhausted, without blocking polling, downloads or publication.
  const reset = Number(headers.get("x-ratelimit-reset"));
  return Math.min(300000, Math.max(65000, Number.isFinite(reset) ? (reset + 5) * 1000 : 0));
}

export class PrintfulClient {
  mockupCooldownMs = 0;
  constructor(private fetcher: typeof fetch = fetch, private storeId?: string) {}
  async request<T>(path: string, body?: unknown): Promise<T> {
    const credentials = await printfulCredentials(this.storeId);
    const response = await this.fetcher(`https://api.printful.com${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${credentials.token}`,
        "X-PF-Store-Id": credentials.storeId ?? "",
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (path.startsWith("/mockup-generator/create-task/")) {
      this.mockupCooldownMs = mockupQuotaCooldown(response.headers);
      const rateHeaders = Object.fromEntries([...response.headers].filter(([name]) => /rate.?limit|retry-after/i.test(name)));
      console.info("lineup.printful_submission", { status: response.status, rateHeaders });
    }
    const json = await response.json().catch(() => null);
    if (!response.ok)
      throw new PrintfulError(
        response.status,
        String(
          json?.error?.message ?? json?.result ?? response.statusText,
        ).slice(0, 500),
        Math.max(
          65_000,
          (Number(response.headers.get("retry-after")) || 0) * 1000 + 5000,
        ),
      );
    return (json?.result ?? json?.data) as T;
  }
  catalog() {
    return this.request<CatalogProduct[]>("/products");
  }
  product(id: number) {
    return this.request<{
      product: CatalogProduct;
      variants: CatalogVariant[];
    }>(`/products/${id}`);
  }
  printfiles(id: number, technique: string) {
    // Preserve legacy defaults; alternate techniques must be explicit.
    return this.request<Printfiles>(
      `/mockup-generator/printfiles/${id}${explicitTechnique(technique) ? `?technique=${encodeURIComponent(explicitTechnique(technique)!)}` : ""}`,
    );
  }
  async resolve(template: ProductTemplate): Promise<number> {
    if (template.catalog_product_id) return template.catalog_product_id;
    const match = template.catalog_match.trim().toLowerCase();
    const products = (await this.catalog()).filter((p) => !p.is_discontinued);
    const matches = products.filter(
      (p) =>
        p.model?.toLowerCase() === match || p.title.toLowerCase() === match,
    );
    if (matches.length !== 1)
      throw new Error(
        `Select the exact Printful catalog product for ${template.title}`,
      );
    return matches[0].id;
  }
  createMockup(
    productId: number,
    batch: MockupBatch,
    template: ProductTemplate,
    options?: string[],
  ) {
    const { width, height } = batch.printfile;
    return this.request<{ task_key: string }>(
      `/mockup-generator/create-task/${productId}`,
      {
        variant_ids:
          batch.representatives?.map((r) => r.id) ?? batch.variantIds,
        format: "jpg",
        ...(options ? { options } : {}),
        files: [
          {
            placement: printfulPlacement(template.placement),
            image_url: batch.artworkUrl,
            position: {
              area_width: width,
              area_height: height,
              width,
              height,
              top: 0,
              left: 0,
            },
          },
        ],
        ...(explicitTechnique(template.technique)
          ? { technique: explicitTechnique(template.technique) }
          : {}),
        ...(template.option_groups.length
          ? { option_groups: template.option_groups }
          : {}),
      },
    );
  }
  poll(taskKey: string) {
    return this.request<{
      status: string;
      error?: string;
      mockups?: import("./gallery").SupplierMockup[];
    }>(`/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`);
  }
  async ensureSyncProduct(
    externalId: string,
    payload: SyncPayload,
  ): Promise<SyncResult> {
    const path = `/store/products/@${encodeURIComponent(externalId)}`;
    try {
      return await this.request<SyncResult>(path);
    } catch (error) {
      if (!(error instanceof PrintfulError) || error.status !== 404)
        throw error;
    }
    const branded = await addInsideLabels(payload, this.request.bind(this));
    await this.request("/store/products", {
      ...branded,
      sync_product: { ...payload.sync_product, external_id: externalId },
    });
    return this.request<SyncResult>(path);
  }
}

export function groupPrintfiles(
  data: Printfiles,
  variantIds: number[],
  placement: string,
): MockupBatch[] {
  placement = printfulPlacement(placement);
  if (!data.available_placements[placement])
    throw new Error(
      `Printful does not support placement ${placement} for this product`,
    );
  const grouped = new Map<number, number[]>();
  for (const id of variantIds) {
    const printfileId = data.variant_printfiles.find((v) => v.variant_id === id)
      ?.placements[placement];
    if (!printfileId)
      throw new Error(`No ${placement} print area for variant ${id}`);
    grouped.set(printfileId, [...(grouped.get(printfileId) ?? []), id]);
  }
  return [...grouped].flatMap(([id, ids]) => {
    const printfile = data.printfiles.find((p) => p.printfile_id === id);
    if (!printfile) throw new Error(`Missing printfile dimensions for ${id}`);
    return Array.from({ length: Math.ceil(ids.length / 5) }, (_, i) => ({
      printfile,
      variantIds: ids.slice(i * 5, i * 5 + 5),
    }));
  });
}
