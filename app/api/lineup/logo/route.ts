import { after } from "next/server";
import { lineupStoreAccess } from "@/lib/lineup/access";
import { prepareLogo } from "@/lib/lineup/logo-preparation";
import { runLineupWorker } from "@/lib/lineup/worker";

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const storeId = String(form.get("storeId") ?? "");
    const file = form.get("logo");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 4 * 1024 * 1024
    )
      throw new Error("Choose a PNG, JPG, or WebP logo under 4 MB");
    const { db } = await lineupStoreAccess(storeId);
    const { bytes, warnings } = await prepareLogo(
      Buffer.from(await file.arrayBuffer()),
      form.get("removeBackground") !== "false",
    );
    const path = `${storeId}/logos/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await db.storage
      .from("lineup-assets")
      .upload(path, bytes, { contentType: "image/png" });
    if (uploadError) throw uploadError;
    const logoUrl = db.storage.from("lineup-assets").getPublicUrl(path)
      .data.publicUrl;
    const { error } = await db
      .from("stores")
      .update({ lineup_logo_path: path, logo_url: logoUrl })
      .eq("id", storeId);
    if (error) throw error;
    after(() =>
      runLineupWorker().catch((error) =>
        console.error("Lineup worker:", error.message),
      ),
    );
    return Response.json({ success: true, logoUrl, warnings });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Logo upload failed" },
      { status: 400 },
    );
  }
}
