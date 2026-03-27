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
    // Fetch both mockup styles (v2) and printfiles (legacy, for dimensions)
    const [styles, printfiles] = await Promise.all([
      printfulGet(`/v2/catalog-products/${productId}/mockup-styles`),
      printfulGet(`/mockup-generator/printfiles/${productId}`),
    ]);

    return NextResponse.json({ styles, printfiles });
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

  try {
    // Use v2 API for mockup generation
    const taskBody: {
      format: string;
      products: Array<{
        source: string;
        catalog_product_id: number;
        catalog_variant_ids: number[];
        mockup_style_ids?: number[];
        placements: Array<{
          placement: string;
          technique: string;
          layers: Array<{
            type: string;
            url: string;
            position?: {
              width: number;
              height: number;
              top: number;
              left: number;
            };
          }>;
        }>;
      }>;
    } = {
      format: "jpg",
      products: [
        {
          source: "catalog",
          catalog_product_id: productId,
          catalog_variant_ids: variantIds?.slice(0, 5) || [],
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

    // Add specific style IDs if provided
    if (styleIds?.length > 0) {
      taskBody.products[0].mockup_style_ids = styleIds;
    }

    const result = await printfulPost("/v2/mockup-tasks", taskBody);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
