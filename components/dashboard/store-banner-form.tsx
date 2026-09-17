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
  bannerTextColor,
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
  const [headerColor, setHeaderColor] = useState(
    store.header_color ?? "#ffffff",
  );
  const [headerText, setHeaderText] = useState(
    store.header_text_color ?? "#000000",
  );
  const [bannerText, setBannerText] = useState(
    store.banner_text_color ?? bannerTextColor(color),
  );
  const [automaticText, setAutomaticText] = useState(
    store.banner_text_color == null,
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
        <h2 className="text-lg font-semibold">Storefront header and banner</h2>
        <p className="text-sm text-muted-foreground">
          Customize the top navigation header, the banner, and the text colors.
        </p>
      </div>
      <fieldset disabled={pending} className="space-y-4">
        <ColorField
          name="headerColor"
          label="Header background color"
          value={headerColor}
          onChange={setHeaderColor}
        />
        <ColorField
          name="headerTextColor"
          label="Header text color"
          value={headerText}
          onChange={setHeaderText}
        />

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
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="automaticBannerText"
            checked={automaticText}
            onChange={(e) => setAutomaticText(e.target.checked)}
          />
          Automatically choose readable banner text
        </label>
        {!automaticText && (
          <ColorField
            name="bannerTextColor"
            label="Banner text color"
            value={bannerText}
            onChange={setBannerText}
          />
        )}
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
          color can be automatic or chosen above.
        </p>
      </fieldset>
      <div className="overflow-hidden rounded-lg border">
        <div
          aria-label="Header preview"
          className="flex min-h-16 items-center justify-between gap-3 px-4 py-3"
          style={{
            backgroundColor: isBannerColor(headerColor)
              ? headerColor
              : "#ffffff",
            color: isBannerColor(headerText) ? headerText : "#000000",
          }}
        >
          <span className="font-bold break-words">{store.name}</span>
          <span className="flex shrink-0 gap-3 text-sm">
            <span>Products</span>
            <span>Cart</span>
          </span>
        </div>
        <StoreBanner
          preview
          store={{
            ...store,
            banner_color: bannerColor(color),
            banner_subtitle: subtitle,
            banner_text_color: automaticText
              ? null
              : isBannerColor(bannerText)
                ? bannerText
                : "#000000",
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
          Header and banner saved. Your storefront has been updated.
        </p>
      )}
      <Button
        type="submit"
        disabled={
          pending ||
          !isBannerColor(color) ||
          !isBannerColor(headerColor) ||
          !isBannerColor(headerText) ||
          (!automaticText && !isBannerColor(bannerText))
        }
      >
        {pending ? "Saving…" : "Save appearance"}
      </Button>
    </form>
  );
}

function ColorField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          id={name}
          aria-label={`Pick ${label.toLowerCase()}`}
          type="color"
          value={isBannerColor(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded border p-1"
        />
        <input
          name={name}
          aria-label={`${label} hex code`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          pattern="#[0-9a-fA-F]{6}"
          maxLength={7}
          className="h-11 w-32 rounded-md border px-3 font-mono"
        />
      </div>
    </div>
  );
}
