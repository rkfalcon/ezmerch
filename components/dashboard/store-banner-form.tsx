"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  StoreBanner,
  type BannerStore,
} from "@/components/storefront/store-banner";
import {
  bannerColor,
  defaultBannerSubtitle,
  isBannerColor,
} from "@/lib/store-banner";
import { updateStoreBanner } from "@/app/actions/store-banner";

export function StoreBannerForm({
  store,
}: {
  store: BannerStore & { id: string };
}) {
  const router = useRouter();
  const [color, setColor] = useState(
    bannerColor(store.banner_color, store.brand_colors.primary),
  );
  const [subtitle, setSubtitle] = useState(
    store.banner_subtitle ?? defaultBannerSubtitle,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function save(formData: FormData) {
    setPending(true);
    setError("");
    setSaved(false);
    try {
      const result = await updateStoreBanner(store.id, formData);
      if (result.error) setError(result.error);
      else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Could not save your banner. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      action={save}
      className="mb-8 max-w-2xl space-y-4 rounded-xl border p-5"
      onChange={() => setSaved(false)}
    >
      <div>
        <h2 className="text-lg font-semibold">Storefront banner</h2>
        <p className="text-sm text-muted-foreground">
          Customize the banner behind your store name and the text below it.
        </p>
      </div>
      <fieldset disabled={pending} className="space-y-4">
        <div>
          <label
            htmlFor={`banner-color-${store.id}`}
            className="block text-sm font-medium mb-2"
          >
            Banner background color
          </label>
          <div className="flex items-center gap-3">
            <input
              id={`banner-color-${store.id}`}
              aria-label="Pick banner color"
              type="color"
              value={isBannerColor(color) ? color : "#efefef"}
              onChange={(e) => setColor(e.target.value)}
              className="h-11 w-14 cursor-pointer rounded border p-1"
            />
            <input
              name="bannerColor"
              aria-label="Banner color hex code"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              pattern="#[0-9a-fA-F]{6}"
              required
              maxLength={7}
              className="h-11 w-32 rounded-md border px-3 font-mono"
            />
          </div>
        </div>
        <label className="block text-sm font-medium">
          Text below store name
          <textarea
            name="bannerSubtitle"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={240}
            rows={3}
            className="mt-2 block w-full rounded-md border px-3 py-2"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          {subtitle.length}/240 characters. Leave blank to hide this text. Text
          color adjusts automatically for readability.
        </p>
      </fieldset>
      <div className="overflow-hidden rounded-lg border">
        <StoreBanner
          preview
          store={{
            ...store,
            banner_color: bannerColor(color),
            banner_subtitle: subtitle,
          }}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-emerald-700">
          Banner saved. Your storefront has been updated.
        </p>
      )}
      <Button type="submit" disabled={pending || !isBannerColor(color)}>
        {pending ? "Saving…" : "Save banner"}
      </Button>
    </form>
  );
}
