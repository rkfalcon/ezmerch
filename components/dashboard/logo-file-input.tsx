"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import type { LogoQuality } from "@/lib/lineup/print-quality";
type Preview = {
  id: string;
  status: string;
  preview: string;
  original: string;
  enhanced: string | null;
  metadata: LogoQuality;
  enhancedMetadata: LogoQuality | null;
  warnings: string[];
  enhancementAvailable: boolean;
  error?: string;
};
export function LogoFileInput({
  disabled,
  onReady,
}: {
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [remove, setRemove] = useState(true),
    [result, setResult] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [enhanced, setEnhanced] = useState(false),
    [polling, setPolling] = useState(false);
  useEffect(() => {
    onReady(!!result && !busy && !polling);
  }, [result, busy, polling, onReady]);
  useEffect(() => {
    if (!file) return;
    const abort = new AbortController();
    const form = new FormData();
    form.set("logo", file);
    form.set("removeBackground", String(remove));
    fetch("/api/lineup/logo/prepare", {
      method: "POST",
      body: form,
      signal: abort.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (!abort.signal.aborted) {
          setResult(data);
          setEnhanced(data.status === "enhanced");
          setPolling(data.status === "queued" || data.status === "submitting");

        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });
    return () => abort.abort();
  }, [file, remove]);
  const preparationId = result?.id;
  useEffect(() => {
    if (!polling || !preparationId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    async function check() {
      try {
        const r = await fetch(`/api/lineup/logo/enhance?id=${preparationId}`, {
          signal: abort.signal,
        });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        if (abort.signal.aborted) return;
        setResult(data);
        if (data.status === "enhanced") {
          setEnhanced(true);
          setPolling(false);
          return;
        }
        if (data.status === "failed")
          throw Error(data.error || "Enhancement failed.");
        if (Date.now() - started > 5 * 60_000)
          throw Error(
            "Enhancement is still processing. You can check again or use the original.",
          );
        timer = setTimeout(check, 6000);
      } catch (e) {
        if (!abort.signal.aborted) {
          setError("");
          setPolling(false);
        }
      }
    }
    timer = setTimeout(check, 3000);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [polling, preparationId]); // Only restart when the selected upload changes.
  function reset() {
    setResult(null);
    setEnhanced(false);
    setPolling(false);
    setError("");
    onReady(false);
  }
  const imageStyle = {
    backgroundColor: "#ddd",
    backgroundImage: "conic-gradient(#fff 25%,#ddd 0 50%,#fff 0 75%,#ddd 0)",
    backgroundSize: "16px 16px",
  };
  return (
    <div className="w-full min-w-0 space-y-3">
      <label className="block space-y-2 text-sm">
        Logo file
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled || busy || polling}
          onChange={(e) => {
            reset();
            setFile(e.target.files?.[0] ?? null);
            setBusy(!!e.target.files?.[0]);
          }}
        />
      </label>
      <input type="hidden" name="preparationId" value={result?.id ?? ""} />
      <input type="hidden" name="useEnhanced" value={String(enhanced)} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remove}
          disabled={disabled || busy || polling}
          onChange={(e) => {
            reset();
            setRemove(e.target.checked);
            setBusy(!!file);
          }}
        />
        Automatically remove a plain background
      </label>
      <p className="text-xs text-muted-foreground">
        PNG, JPG or WebP, up to 4 MB and 25 megapixels. Start with your
        highest-resolution original. Your original upload is preserved
        privately.
      </p>
      <p className="text-xs text-muted-foreground">
        We prepare your logo, choose suitable print sizes, and check each product.
        If artwork needs extra attention, the VeryMerch team handles it for you.
      </p>
      {(busy || polling) && <p role="status">Preparing your logo automatically…</p>}
      {result && (
        <div className="rounded-lg border p-4 space-y-3">
          <img src={enhanced ? result.enhanced! : result.preview}
            alt="Prepared store logo" className="h-40 w-full object-contain" style={imageStyle} />
          <p className="text-sm">{polling ? "Enhancing your logo. This may take a minute." :
            "Your logo is saved. Continue to prepare your products; no artwork approval is needed from you."}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
