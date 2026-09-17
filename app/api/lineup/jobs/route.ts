import { after } from "next/server";
import { lineupAdmin, lineupStoreAccess } from "@/lib/lineup/access";
import { runLineupWorker } from "@/lib/lineup/worker";

export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
    const { db } = await lineupStoreAccess(storeId);
    const { data, error } = await db
      .from("product_generation_jobs")
      .select(
        "id,status,last_error,template_snapshot,publish_on_complete,updated_at",
      )
      .eq("store_id", storeId)
      .order("created_at");
    if (error) throw error;
    return Response.json({
      jobs: (data ?? []).map((j) => ({
        id: j.id,
        status: j.status,
        error: j.last_error,
        title: j.template_snapshot.title,
        publish: j.publish_on_complete,
      })),
    });
  } catch {
    return Response.json(
      { error: "Could not load generation progress" },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  try {
    await lineupAdmin();
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const { storeId, jobId } = await request.json();
    const { db } = await lineupStoreAccess(storeId);
    const { error } = await db
      .from("product_generation_jobs")
      .update({
        status: "pending",
        attempts: 0,
        last_error: null,
        lease_token: null,
        lease_until: null,
        available_at: new Date().toISOString(),
      })
      .eq("id", jobId)
      .eq("store_id", storeId)
      .eq("status", "failed")
      .select("id")
      .single();
    if (error) throw error;
    after(() =>
      runLineupWorker().catch((error) =>
        console.error("Lineup worker:", error.message),
      ),
    );
    return Response.json({ success: true });
  } catch {
    return Response.json(
      { error: "Retry could not be queued" },
      { status: 400 },
    );
  }
}
