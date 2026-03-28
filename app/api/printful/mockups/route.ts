import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

const PRINTFUL_API = "https://api.printful.com";
const PRINTFUL_TOKEN = process.env.PRINTFUL_API_TOKEN!;

async function printfulGet(endpoint: string) {
  const res = await fetch(`${PRINTFUL_API}${endpoint}`, {
    headers: { Authorization: `Bearer ${PRINTFUL_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Printful API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data ?? json.result ?? json;
}

async function printfulPost(endpoint: string, body: unknown) {
  const res = await fetch(`${PRINTFUL_API}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Printful API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data ?? json.result ?? json;
}

// GET: Fetch mockup styles, or poll for task result
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const taskId = searchParams.get("taskId");
  const taskKey = searchParams.get("taskKey");

  // Poll v2 task
  if (taskId) {
    try {
      const result = await printfulGet(`/v2/mockup-tasks?id=${taskId}`);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  // Poll legacy task
  if (taskKey) {
    try {
      const result = await printfulGet(`/mockup-generator/task?task_key=${taskKey}`);
      return NextResponse.json(result);
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }

  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  try {
    // Fetch printfiles (legacy API — reliable, gives dimensions)
    const printfiles = await printfulGet(`/mockup-generator/printfiles/${productId}`);

    // Try v2 styles endpoint, fallback to legacy templates
    let styles = null;
    let templates = null;
    try {
      styles = await printfulGet(`/v2/catalog-products/${productId}/mockup-styles`);
    } catch {
      // v2 not available for this product — try legacy templates
      try {
        templates = await printfulGet(`/mockup-generator/templates/${productId}`);
      } catch {
        // No templates available either
      }
    }

    return NextResponse.json({ styles, templates, printfiles });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

// POST: Create a mockup generation task
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { productId, variantIds, designUrl, placement, position, styleIds, technique } = body;

  if (!productId || !designUrl) {
    return NextResponse.json({ error: "productId and designUrl required" }, { status: 400 });
  }

  // Try v2 first, fallback to legacy
  try {
    const v2Body = {
      format: "jpg",
      products: [
        {
          source: "catalog",
          catalog_product_id: productId,
          catalog_variant_ids: variantIds?.slice(0, 5) || [],
          ...(styleIds?.length > 0 ? { mockup_style_ids: styleIds } : {}),
          placements: [
            {
              placement: placement || "front",
              technique: technique || "dtg",
              layers: [
                {
                  type: "file",
                  url: designUrl,
                  ...(position ? { position } : {}),
                },
              ],
            },
          ],
        },
      ],
    };

    const result = await printfulPost("/v2/mockup-tasks", v2Body);
    return NextResponse.json({ ...result, api: "v2" });
  } catch {
    // Fallback to legacy API
    try {
      const legacyBody: {
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
        option_groups?: string[];
      } = {
        variant_ids: variantIds?.slice(0, 5) || [],
        format: "jpg",
        files: [
          {
            placement: placement || "front",
            image_url: designUrl,
          },
        ],
      };

      // Convert v2 position (inches) to legacy position (pixels) if we have printfile data
      if (position) {
        // For legacy, position needs area_width/area_height in pixels
        // We'll let the caller pass pixel-based position via legacyPosition
      }

      const result = await printfulPost(
        `/mockup-generator/create-task/${productId}`,
        legacyBody
      );
      return NextResponse.json({ ...result, api: "legacy" });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
  }
}
