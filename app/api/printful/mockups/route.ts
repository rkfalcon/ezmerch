import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  getMockupTemplates,
  getMockupPrintfiles,
  createMockupTask,
  getMockupTaskResult,
} from "@/lib/printful";

// GET: Fetch templates and printfiles for a product
export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId");
  const taskKey = searchParams.get("taskKey");

  // Poll for task result
  if (taskKey) {
    try {
      const result = await getMockupTaskResult(taskKey);
      return NextResponse.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get task result";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!productId) {
    return NextResponse.json({ error: "productId required" }, { status: 400 });
  }

  try {
    const [templates, printfiles] = await Promise.all([
      getMockupTemplates(parseInt(productId, 10)),
      getMockupPrintfiles(parseInt(productId, 10)),
    ]);

    return NextResponse.json({ templates, printfiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch mockup data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: Create a mockup generation task
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { productId, variantIds, designUrl, placement, position } =
    await request.json();

  if (!productId || !designUrl) {
    return NextResponse.json(
      { error: "productId and designUrl required" },
      { status: 400 }
    );
  }

  try {
    const file: {
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
    } = {
      placement: placement || "front",
      image_url: designUrl,
    };

    if (position) {
      file.position = position;
    }

    const result = await createMockupTask(productId, {
      variant_ids: variantIds || [],
      format: "jpg",
      files: [file],
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create mockup task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
