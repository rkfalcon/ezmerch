"use client";
import { jobStatus } from "@/lib/lineup/job-status";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogoFileInput } from "./logo-file-input";

interface Job {
  id: string;
  title: string;
  status: string;
  error: string | null;
  publish: boolean;
}
export function LineupLogo({
  storeId,
  logoUrl,
}: {
  storeId: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(false);
  const [image, setImage] = useState(logoUrl);
  const completed = useRef(-1);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/lineup/jobs?storeId=${storeId}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setJobs(data.jobs);
        const count = data.jobs.filter(
          (j: Job) => j.status === "completed",
        ).length;
        if (completed.current >= 0 && count !== completed.current)
          router.refresh();
        completed.current = count;
      } catch (e) {
        if (e instanceof Error && e.name !== "AbortError") setError(e.message);
      }
    }
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [storeId, router]);
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
          your prices and enabled colors. Existing listings keep their previous
          artwork until each replacement is ready.
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
        <ul className="divide-y">
          {jobs.map((j) => (
            <li
              key={j.id}
              className="py-3 flex flex-wrap justify-between gap-2"
            >
              <div>
                <p className="text-sm font-medium">{j.title}</p>
                <p className="text-xs text-muted-foreground">
                  {jobStatus(j.status, j.error).label} ·{" "}
                  {j.publish ? "Initial lineup" : "Draft addition"}
                </p>
                {jobStatus(j.status, j.error).message && (
                  <p
                    className={`text-xs max-w-xl break-words ${jobStatus(j.status, j.error).failed ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {jobStatus(j.status, j.error).message}
                  </p>
                )}
              </div>
              {j.status === "failed" && (
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
