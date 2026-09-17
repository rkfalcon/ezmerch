import { lineupAdmin } from "@/lib/lineup/access";
import { PrintfulClient } from "@/lib/lineup/printful";

export async function GET(request: Request) {
  try {
    await lineupAdmin();
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("productId"));
    const client = new PrintfulClient();
    if (id) {
      const [catalog, files] = await Promise.all([
        client.product(id),
        client.printfiles(id, url.searchParams.get("technique") ?? "dtg"),
      ]);
      return Response.json({ ...catalog, files });
    }
    return Response.json({ products: await client.catalog() });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not load catalog",
      },
      { status: 502 },
    );
  }
}
