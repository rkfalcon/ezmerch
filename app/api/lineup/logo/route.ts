import { tryScheduleLineupWakeup } from "@/lib/lineup/queue";
import { createQuickPreviews } from "@/lib/lineup/quick-previews";
import { after } from "next/server";
import { lineupStoreAccess } from "@/lib/lineup/access";
import { approvedLogo, storeApprovedLogo } from "@/lib/lineup/prepared-logo";
import { runLineupWorker } from "@/lib/lineup/worker";

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const storeId = String(form.get("storeId") ?? "");
    const { db, user } = await lineupStoreAccess(storeId);
    const logo = await approvedLogo(db, user.id, form);
    const { path, logoUrl } = await storeApprovedLogo(db, storeId, logo);
    const warnings = logo.warnings;
    const { error } = await db
      .from("stores")
      .update({ lineup_logo_path: path, logo_url: logoUrl })
      .eq("id", storeId);
    if (error) throw error;
    after(() =>
      createQuickPreviews(storeId, path).catch((e) =>
        console.error("Quick previews:", e.message),
      ),
    );
    after(() =>
      runLineupWorker().finally(() => tryScheduleLineupWakeup()).catch((error) =>
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
