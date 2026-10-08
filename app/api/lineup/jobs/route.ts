import { storeProductSummary } from "@/lib/lineup/store-product-summary";
import { jobProgress } from "@/lib/lineup/job-progress";
import {cachedReviewImage} from "@/lib/lineup/review-mockup-cache";
import type {GenerationJob} from "@/lib/lineup/types";
import { resetReview } from "@/lib/lineup/review-adjustment";
import { tryScheduleLineupWakeup } from "@/lib/lineup/queue";
import type { GenerationState } from "@/lib/lineup/types";
import { jobPreview } from "@/lib/lineup/job-preview";
import { after } from "next/server";
import { lineupStoreAccess } from "@/lib/lineup/access";
import { runLineupWorker } from "@/lib/lineup/worker";

export const maxDuration = 300;
export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get("storeId") ?? "";
    const { db, user } = await lineupStoreAccess(storeId);
    const { data, error } = await db
      .from("product_generation_jobs")
      .select(
        "product_templates(active,disabled_at),id,template_id,status,last_error,review_mockup,logo_path,generation_id,quick_preview_url,quick_preview_plan,template_snapshot,publish_on_complete,updated_at,quality:state->printQuality,preview:state->instantPreview,plan:state->artworkPlan,embroidery:state->embroideryLogoPath,batches:state->batches,previewPlan:state->instantPreviewPlan,variants:state->variants,publishedCount:state->publishedVariantCount",
      )
      .eq("store_id", storeId)
      .order("created_at");
    if (error) throw error;
    const { data: products, error: productsError } = await db.from("products")
      .select("id,template_id,published,variants,default_color,enabled_colors,global_enabled_colors")
      .eq("store_id",storeId);
    if (productsError) throw productsError;
    const byTemplate = new Map((products ?? []).map(product => [product.template_id, storeProductSummary(product as unknown as Parameters<typeof storeProductSummary>[0])]));
    return Response.json({
      jobs: (data ?? []).map((j) => ({
        id: j.id,
        product: byTemplate.get(j.template_id) ?? null,
        progress: jobProgress({ variants: j.variants, batches: j.batches, publishedVariantCount: j.publishedCount, printQuality: j.quality } as unknown as GenerationState, j.status),
        active: (j.product_templates as unknown as {active: boolean} | null)?.active ?? false,
        disabledAt: (j.product_templates as unknown as {disabled_at: string | null} | null)?.disabled_at,
        generationId: j.generation_id,
        status: j.status,
        error: user.isAdmin ? j.last_error : (j.status === "failed" ? "VeryMerch is preparing this artwork. No action is needed from you." : null),
        title: j.template_snapshot.title,
        publish: j.publish_on_complete,
        quality: user.isAdmin ? j.quality : undefined,
        reviewImage: user.isAdmin ? cachedReviewImage({ ...j, state: {batches:j.batches,artworkPlan:j.plan} } as unknown as GenerationJob,j.review_mockup) : undefined,
        reviewTemplate: user.isAdmin ? { ...j.template_snapshot, ...(j.plan as GenerationState["artworkPlan"]) } : undefined,
        ...jobPreview({ instantPreview: j.preview, artworkPlan: j.plan, embroideryLogoPath: j.embroidery, batches: j.batches, instantPreviewPlan: j.previewPlan } as unknown as GenerationState, j.template_snapshot, j.quick_preview_url, j.quick_preview_plan as GenerationState["artworkPlan"]),
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
    const { storeId, jobId, approveQuality, prepareAgain, adjustment } = await request.json();
    const { db, user } = await lineupStoreAccess(storeId);
    if (!user.isAdmin) return Response.json({ error: "VeryMerch handles artwork reviews and retries." }, { status: 403 });
    const { data: job, error: readError } = await db
      .from("product_generation_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("store_id", storeId)
      .eq("status", "failed")
      .single();
    if (readError || !job)
      throw new Error(
        "This job is no longer awaiting a retry. Refresh and try again.",
      );
    const quality = job.state?.printQuality;
    let reset: ReturnType<typeof resetReview> | undefined;
    if (prepareAgain || adjustment) {
      reset = resetReview(job.state, job.template_snapshot, adjustment);
    } else if (quality?.status === "blocked") {
      throw new Error("Adjust this design or run automatic checks before approving.");
    } else if (quality?.status === "review" && !quality.reviewedAt) {
      if (approveQuality !== true) throw new Error("Review this design before approving it.");
      if(job.template_snapshot.technique.includes("embroidery") && !cachedReviewImage(job as GenerationJob,job.review_mockup))
        throw new Error("Wait for the Printful embroidery mockup and review it before approving.");
      job.state.printQuality = { ...quality, reviewedAt: new Date().toISOString(), reviewedBy: user.id };
    }
    const { error } = await db
      .from("product_generation_jobs")
      .update({
        ...(reset ? {state: reset.state, template_snapshot: reset.template, generation_id: crypto.randomUUID(), quick_preview_url: null, quick_preview_plan: null} : quality ? { state: job.state } : {}),
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
      .eq("updated_at", job.updated_at)
      .select("id")
      .single();
    if (error) throw error;
    after(() =>
      runLineupWorker().catch((error) =>
        console.error("Lineup worker:", error.message),
      ).finally(() => tryScheduleLineupWakeup()),
    );
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Retry could not be queued",
      },
      { status: 400 },
    );
  }
}
