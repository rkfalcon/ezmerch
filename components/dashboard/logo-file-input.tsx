"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function LogoFileInput({
  disabled,
  onReady,
}: {
  disabled?: boolean;
  onReady: (ready: boolean) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [remove, setRemove] = useState(true);
  const [preview, setPreview] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [preparing, setPreparing] = useState(false);
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
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        if (!abort.signal.aborted) {
          setPreview(data.preview);
          setWarnings(data.warnings);
          onReady(true);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setPreparing(false);
      });
    return () => abort.abort();
  }, [file, remove, onReady]);
  return (
    <div className="space-y-3">
      <label className="block space-y-2 text-sm">
        Logo file
        <Input
          type="file"
          name="logo"
          accept="image/png,image/jpeg,image/webp"
          required
          disabled={disabled}
          onChange={(e) => {
            onReady(false);
            setPreview("");
            setError("");
            setWarnings([]);
            setPreparing(!!e.target.files?.[0]);
            setFile(e.target.files?.[0] ?? null);
          }}
        />
      </label>
      <input type="hidden" name="removeBackground" value={String(remove)} />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={remove}
          disabled={disabled}
          onChange={(e) => {
            onReady(false);
            setPreview("");
            setError("");
            setWarnings([]);
            setPreparing(!!file);
            setRemove(e.target.checked);
          }}
        />
        Automatically remove a plain background
      </label>
      <p className="text-xs text-muted-foreground">
        PNG, JPG, or WebP, up to 4 MB. Transparent artwork is preserved. Review
        the cleaned logo before continuing.
      </p>
      {preparing && (
        <p role="status" className="text-sm">
          Preparing your logo preview…
        </p>
      )}
      {preview && (
        <div>
          <img
            alt="Prepared logo preview"
            src={preview}
            className="h-36 w-36 rounded border object-contain p-2"
            style={{
              backgroundColor: "#ddd",
              backgroundImage:
                "conic-gradient(#fff 25%,#ddd 0 50%,#fff 0 75%,#ddd 0)",
              backgroundSize: "16px 16px",
            }}
          />
          <p className="text-xs text-muted-foreground">
            Checkerboard areas will not print.
          </p>
        </div>
      )}
      {warnings.map((w) => (
        <p key={w} role="status" className="text-sm text-amber-800">
          {w}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
