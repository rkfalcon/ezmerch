import { after } from "next/server";
import { onboardingStore } from "@/lib/onboarding/store";
import { onboardingDetails } from "@/lib/onboarding/validation";
import { prepareLogo } from "@/lib/lineup/logo-preparation";
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
        .select("id,template_id,status,state,template_snapshot")
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
          product && (!job || job.status === "completed")
            ? productDisplayImage(product)
            : (batches.flatMap((b) => b.images ?? b.downloadedImages ?? [])[0]
                ?.url ?? null),
        ready: !!product && (!job || job.status === "completed"),
        jobId: job?.id,
        status:
          product && (!job || job.status === "completed")
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
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
      throw new Error("Choose a PNG, JPG, or WebP logo under 4 MB.");
    const { bytes, warnings } = await prepareLogo(
      Buffer.from(await file.arrayBuffer()),
      form.get("removeBackground") !== "false",
    );
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 32) || "store";
    const { data: id, error: createError } = await db.rpc(
      "create_onboarding_store",
      {
        p_owner: user.id,
        p_name: name,
        p_website: websiteUrl,
        p_slug: `${base}-${crypto.randomUUID().slice(0, 8)}`,
      },
    );
    if (createError) throw createError;
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
    const path = `${id}/logos/${crypto.randomUUID()}.png`;
    const { error: uploadError } = await db.storage
      .from("lineup-assets")
      .upload(path, bytes, { contentType: "image/png" });
    if (uploadError) throw uploadError;
    const logoUrl = db.storage.from("lineup-assets").getPublicUrl(path)
      .data.publicUrl;
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
      runLineupWorker().catch((e) =>
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
