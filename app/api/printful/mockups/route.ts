import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";

const PRINTFUL_API = "https://api.printful.com";
const PRINTFUL_TOKEN = process.env.PRINTFUL_API_TOKEN!;
const PRINTFUL_STORE_ID = process.env.PRINTFUL_STORE_ID!;

async function printfulGet(endpoint: string) {
  const res = await fetch(`${PRINTFUL_API}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${PRINTFUL_TOKEN}`,
      "X-PF-Store-Id": PRINTFUL_STORE_ID,
    },
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
      "X-PF-Store-Id": PRINTFUL_STORE_ID,
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

  try {
    // Fetch printfile dimensions for proper position calculation
    let printfileWidth = 1800;
    let printfileHeight = 2400;
    let firstVariantId: number | null = null;

    try {
      const printfileData = await printfulGet(`/mockup-generator/printfiles/${productId}`);
      // printfulGet returns json.data ?? json.result, so printfileData is the result object
      const pf = printfileData.printfiles ?? printfileData;
      if (Array.isArray(pf) && pf[0]) {
        printfileWidth = pf[0].width;
        printfileHeight = pf[0].height;
      }
      // Get a valid variant ID if none provided
      const variantPrintfiles = printfileData.variant_printfiles ?? [];
      if (variantPrintfiles[0]) {
        firstVariantId = variantPrintfiles[0].variant_id;
      }
    } catch {
      // Use defaults
    }

    // Ensure we have at least one variant ID
    const finalVariantIds = variantIds?.length > 0
      ? variantIds.slice(0, 5)
      : firstVariantId
        ? [firstVariantId]
        : [];

    // Build centered position at the given scale
    const scale = position?.scale ?? 0.8;
    const designW = Math.round(printfileWidth * scale);
    const designH = Math.round(printfileHeight * scale);
    const legacyPosition = {
      area_width: printfileWidth,
      area_height: printfileHeight,
      width: designW,
      height: designH,
      top: Math.round((printfileHeight - designH) / 2),
      left: Math.round((printfileWidth - designW) / 2),
    };

    const legacyBody = {
      variant_ids: finalVariantIds,
      format: "jpg",
      files: [
        {
          placement: placement || "front",
          image_url: designUrl,
          position: legacyPosition,
        },
      ],
    };

    const result = await printfulPost(
      `/mockup-generator/create-task/${productId}`,
      legacyBody
    );
    return NextResponse.json({ ...result, api: "legacy" });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
