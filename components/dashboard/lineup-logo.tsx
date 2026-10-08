"use client";
import { LineupProductPrice } from "./lineup-product-price";
import { DisabledDate } from "./disabled-date";
import { disabledProductClass } from "./product-availability";
import { productTitle } from "@/lib/product-title";
import { PrintQualityReview } from "./print-quality-review";
import type { PrintQualityReport } from "@/lib/lineup/print-quality";
import { jobStatus } from "@/lib/lineup/job-status";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoFileInput } from "./logo-file-input";

interface Job {
  product?: ReturnType<typeof import("@/lib/lineup/store-product-summary").storeProductSummary> | null;
  progress?: import("@/lib/lineup/job-progress").JobProgress;
  active?: boolean;
  disabledAt?: string | null;
  generationId?: string | null;
  reviewImage?: string | null;
  reviewTemplate?: import("@/lib/lineup/types").ProductTemplate;
  imageKind?: "mockup" | "placement" | "approximate";
  image?: string | null;
  quality?: PrintQualityReport;
  id: string;
  title: string;
  status: string;
  error: string | null;
  publish: boolean;
}
export function LineupLogo({
  storeId,
  logoUrl,
  adminView = false,
}: {
  adminView?: boolean;
  storeId: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const displayStatus = (job: Job) => job.active === false
    ? { label: "Disabled globally", message: "Unavailable for purchase in all stores. Contact help@verymerch.com with any concerns.", failed: false }
    : !adminView && job.status === "failed"
    ? { label: "VeryMerch is preparing this product", message: "Our team will handle the artwork. No action is needed from you.", failed: false }
    : jobStatus(job.status, job.error);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [image, setImage] = useState(logoUrl);
  const completed = useRef("");
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [pollError, setPollError] = useState(false);
  const [pollRevision, setPollRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        const response = await fetch(`/api/lineup/jobs?storeId=${storeId}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (cancelled) return;
        setJobs(data.jobs.map((job: Job) => job.product?.image && (job.progress?.firstPublished || job.status === "completed")
          ? {...job,image:job.product.image,imageKind:"mockup"} : job));
        setLastChecked(new Date().toLocaleTimeString());
        setPollError(false);
        const count = data.jobs.map((j: Job) => `${j.generationId}:${j.progress?.firstPublished}:${j.progress?.readyColors}:${j.status}`).join("|");
        if (completed.current && count !== completed.current)
          router.refresh();
        completed.current = count;
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") setPollError(true);
      } finally {
        if (!cancelled) timer = setTimeout(load, 3000);
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [storeId, router, pollRevision]);
  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    form.set("storeId", storeId);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lineup/logo", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setImage(data.logoUrl);
      setPollRevision(n => n + 1);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function retry(id: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/lineup/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, jobId: id }),
      });
      if (!response.ok) throw new Error("Retry failed");
      setJobs((current) =>
        current.map((j) =>
          j.id === id ? { ...j, status: "pending", error: null } : j,
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Store logo & product lineup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload once to create products from all active templates. Empty stores
          start live; additions to established stores start as drafts. A
          replacement logo regenerates existing template products, preserving
          your prices and enabled colors. Previous artwork is unavailable for purchase while its replacement is prepared. Each approved color becomes available as soon as it is ready, respecting your publishing and color settings.
        </p>
        <form onSubmit={upload} className="flex flex-wrap items-end gap-3">
          {image && (
            <img
              src={image}
              alt="Store logo"
              className="h-16 w-16 object-contain rounded border"
            />
          )}
          <LogoFileInput disabled={busy} onReady={setLogoReady} />
          <Button type="submit" disabled={busy || !logoReady}>
            {busy
              ? "Working…"
              : image
                ? "Replace logo & regenerate"
                : "Upload logo & generate"}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {!jobs.length && (
          <p className="text-sm text-muted-foreground">
            No generation jobs yet. Activate your product templates, then upload
            this store’s logo.
          </p>
        )}
        <p className="text-sm text-muted-foreground" role="status">
          {jobs.some(j => j.active !== false) && jobs.filter(j => j.active !== false).every((j) => j.status === "completed")
            ? "All product colors have finished preparing. Check Products for availability and publishing status."
            : "We prepare one preview color per product first. Remaining colors are processing in the background. We’ll notify you here and by email when the full lineup is ready. Artwork or stock holds may take longer."}
        </p>
        {busy && <p role="status" className="rounded border p-4 text-sm"><span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Saving your logo and starting product preparation…</p>}
        {jobs.some(j => j.active !== false) && (() => {
          const active = jobs.filter(j => j.active !== false);
          const ready = active.filter(j => j.progress?.firstPublished).length;
          const finished = active.filter(j => j.status === "completed").length;
          return <div className="rounded-lg border bg-muted/30 p-4 space-y-2" role="status" aria-live="polite">
            <p className="font-medium">{ready} of {active.length} products have their first color ready</p>
            <progress className="w-full accent-primary" value={ready} max={active.length} aria-label="Products with first color ready" />
            <p className="text-sm">{finished} of {active.length} products have all colors ready.</p>
            <p className="text-sm text-muted-foreground">Approved first colors are prepared before remaining colors. Ready colors appear on your storefront automatically for enabled products. Draft additions still need to be enabled in Products. We’ll email you when the full lineup finishes.</p>
            <p className="text-xs text-muted-foreground">{pollError ? "Progress updates are temporarily unavailable. Reconnecting automatically…" : `Updates automatically${lastChecked ? ` · Last checked ${lastChecked}` : ""}. You can leave this page; preparation continues in the background.`}</p>
          </div>;
        })()}
        <ul className="divide-y">
          {jobs.map((j) => (
            <li
              key={j.id}
              className={`py-3 flex flex-wrap justify-between gap-2 ${j.active === false ? `${disabledProductClass} rounded-lg border p-4 my-2` : ""}`}
            >
              <div>
                {!j.image && j.active !== false && ["pending", "running"].includes(j.status) && <div className="mb-2 flex h-40 w-40 items-center justify-center rounded border bg-muted/30 p-3 text-center text-xs text-muted-foreground">Your logo preview will appear here automatically.</div>}
                {j.image && !(adminView && j.reviewTemplate?.technique.includes("embroidery") && j.status === "failed") && (
                  <img
                    src={j.image}
                    alt={`${adminView ? j.title : productTitle(j.title)} ${j.imageKind === "mockup" ? "Product mockup" : "logo preview"}`}
                    className="h-40 w-40 object-contain rounded border mb-2"
                  />
                )}
                {j.image && !(adminView && j.reviewTemplate?.technique.includes("embroidery") && j.status === "failed") && (
                  <p className="text-xs text-muted-foreground">
                    {j.imageKind === "mockup" ? "Product mockup" : j.imageKind === "placement" ? "Prepared placement preview · Product mockup pending" : "Approximate design preview · placement checks pending"}
                  </p>
                )}
                <p className="text-sm font-medium">{adminView ? j.title : productTitle(j.title)}</p>
                <p className="text-xs text-muted-foreground">
                  {j.active !== false && ["pending", "running", "completed"].includes(j.status) && (!displayStatus(j).message || j.progress?.firstPublished) ? j.progress?.stage ?? displayStatus(j).label : displayStatus(j).label} ·{" "}
                  {j.product ? j.product.published ? "Published in this store" : "Draft in this store" : j.publish ? "Initial lineup" : "Draft addition"}
                </p>
                {j.active !== false && j.progress && <div className="mt-2 text-xs text-muted-foreground">
                  {j.progress.totalColors > 0 && <><p>{j.progress.readyColors}/{j.progress.totalColors} color previews ready</p><progress className="mt-1 w-40 accent-primary" value={j.progress.readyColors} max={j.progress.totalColors} aria-label={`${productTitle(j.title)} color previews ready`} /></>}
                  {["pending", "running"].includes(j.status) && !displayStatus(j).message && <p className="mt-1"><span aria-hidden="true" className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />{j.progress.stage}. Updates automatically.</p>}
                </div>}
                {adminView && j.product && <LineupProductPrice readOnly productId={j.product.id} variants={j.product.variants} />}
                {j.active === false && <DisabledDate date={j.disabledAt} />}
                {displayStatus(j).message && (
                  <p
                    className={`text-xs max-w-xl break-words ${displayStatus(j).failed ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {displayStatus(j).message}
                  </p>
                )}
              </div>
              {j.active !== false && adminView && j.quality && (
                <PrintQualityReview
                  key={j.id + (j.generationId ?? "")}
                  onQueued={() => {
                    setJobs(current => current.map(job => job.id === j.id ? { ...job, status: "pending", quality: undefined, reviewImage: null, image: null, error: null } : job));
                    setPollRevision(n => n + 1);
                  }}
                  reviewImage={j.reviewImage}
                  quality={j.quality}
                  template={j.reviewTemplate}
                  image={j.image}
                  imageKind={j.imageKind}
                  held={j.status === "failed"}
                  storeId={storeId}
                  jobId={j.id}
                />
              )}
              {j.active !== false && adminView && !j.quality && !displayStatus(j).message && ["pending", "running"].includes(j.status) && (
                <div role="status" className="mt-2 w-full max-w-xl rounded border p-4 text-sm">
                  <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Checking artwork and preparing the adjusted placement…
                  <p className="mt-2 text-muted-foreground">Next: rendering the logo on the product. The new preview will appear here automatically; no refresh is needed.</p>
                </div>
              )}
              {adminView && j.status === "failed" && !j.quality && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => retry(j.id)}
                >
                  Retry
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
