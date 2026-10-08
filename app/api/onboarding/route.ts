import { tryScheduleLineupWakeup } from "@/lib/lineup/queue";
import { jobPreview } from "@/lib/lineup/job-preview";
import { generationUnavailable } from "@/lib/lineup/generation-availability";
import { createQuickPreviews } from "@/lib/lineup/quick-previews";
import { createWithStoreSlug } from "@/lib/onboarding/slug";
import { after } from "next/server";
import { onboardingStore } from "@/lib/onboarding/store";
import { onboardingDetails } from "@/lib/onboarding/validation";
import { approvedLogo, storeApprovedLogo } from "@/lib/lineup/prepared-logo";
import { runLineupWorker } from "@/lib/lineup/worker";
import type { GenerationState } from "@/lib/lineup/types";
import { productDisplayImage } from "@/lib/product-colors";
export const maxDuration = 300;
export async function GET() {
  try {
    const { db, store } = await onboardingStore();
    if (!store) return Response.json({ store: null, products: [] });
    const [
      { data: jobs, error: jError },
      { data: products, error: pError },
      { data: templates, error: tError },
    ] = await Promise.all([
      db
        .from("product_generation_jobs")
        .select(
          "id,template_id,status,state,last_error,template_snapshot,quick_preview_url,quick_preview_plan",
        )
        .eq("store_id", store.id),
      db
        .from("products")
        .select(
          "id,template_id,title,thumbnail_url,variants,enabled_colors,global_enabled_colors,default_color,published",
        )
        .eq("store_id", store.id)
        .eq("global_active", true),
      db.from("product_templates").select("id,title").eq("active", true),
    ]);
    if (jError || pError || tError) throw jError || pError || tError;
    const previews = (templates ?? []).map((t) => {
      const product = products?.find((p) => p.template_id === t.id);
      const job = jobs?.find((j) => j.template_id === t.id);
      const state = job?.state as GenerationState | undefined;
      const batches = state?.batches ?? [];
      return {
        id: t.id,
        title: t.title,
        image:
          product &&
          (!job || job.status === "completed" || !!state?.publishedVariantCount)
            ? productDisplayImage(product)
            : job ? jobPreview(state ?? {}, job.template_snapshot, job.quick_preview_url, job.quick_preview_plan as GenerationState["artworkPlan"]).image : null,
        ready:
          !!product &&
          (!job ||
            job.status === "completed" ||
            !!state?.publishedVariantCount),
        jobId: job?.id,
        quality: state?.printQuality,
        status: generationUnavailable(job?.last_error) ? "unavailable" :
          product &&
          (!job || job.status === "completed" || !!state?.publishedVariantCount)
            ? "ready"
            : (job?.status ?? "pending"),
        completed: batches.filter((b) => b.images).length,
        total: batches.length,
      };
    });
    return Response.json({
      store: {
        id: store.id,
        name: store.name,
        slug: store.slug,
        logo_url: store.logo_url,
        selling_enabled: store.selling_enabled,
      },
      products: previews,
    });
  } catch {
    return Response.json(
      { error: "Unable to load setup. Sign in and try again." },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  try {
    const { user, db } = await onboardingStore();
    if (!user.email_confirmed_at)
      throw new Error("Please confirm your email first.");
    const form = await request.formData();
    const { name, websiteUrl } = onboardingDetails(
      form.get("name"),
      form.get("website"),
    );
    const logo = await approvedLogo(db, user.id, form);
    const warnings = logo.warnings;
    const id = await createWithStoreSlug(name, async (slug) => {
      const { data, error } = await db.rpc("create_onboarding_store", {
        p_owner: user.id,
        p_name: name,
        p_website: websiteUrl,
        p_slug: slug,
      });
      return { data, error };
    });
    const { data: current, error: readError } = await db
      .from("stores")
      .select("lineup_logo_path,onboarding_started_at")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (readError) throw readError;
    if (!current.onboarding_started_at)
      throw new Error(
        "Your store already exists. Manage it from Products and Settings.",
      );
    if (current.lineup_logo_path)
      return Response.json({ success: true, warnings });
    const { path, logoUrl } = await storeApprovedLogo(db, id, logo);
    const { error } = await db
      .from("stores")
      .update({
        name,
        website_url: websiteUrl,
        logo_url: logoUrl,
        lineup_logo_path: path,
      })
      .eq("id", id)
      .eq("owner_id", user.id)
      .is("lineup_logo_path", null);
    if (error) throw error;
    after(() =>
      createQuickPreviews(id, path).catch((e) =>
        console.error("Quick previews:", e.message),
      ),
    );
    after(() =>
      runLineupWorker().finally(() => tryScheduleLineupWakeup()).catch((e) =>
        console.error("Onboarding generation:", e.message),
      ),
    );
    return Response.json({ success: true, warnings });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create your store.",
      },
      { status: 400 },
    );
  }
}
