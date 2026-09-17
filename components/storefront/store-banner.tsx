import {
  bannerColor,
  bannerTextColor,
  defaultBannerSubtitle,
} from "@/lib/store-banner";

export interface BannerStore {
  name: string;
  logo_url: string | null;
  brand_colors: { primary: string };
  header_color?: string | null;
  header_text_color?: string | null;
  banner_text_color?: string | null;
  banner_color?: string | null;
  banner_subtitle?: string | null;
}

export function StoreBanner({
  store,
  preview = false,
}: {
  store: BannerStore;
  preview?: boolean;
}) {
  const background = bannerColor(
    store.banner_color,
    store.brand_colors.primary,
  );
  const subtitle = store.banner_subtitle ?? defaultBannerSubtitle;
  const Heading = preview ? "h3" : "h1";
  return (
    <section
      className="py-16 text-center"
      aria-label={preview ? "Banner preview" : "Store banner"}
      style={{
        backgroundColor: background,
        color: store.banner_text_color ?? bannerTextColor(background),
      }}
    >
      <div className="container mx-auto px-4">
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt={store.name}
            className="mx-auto mb-4 h-20 w-20 object-contain"
          />
        ) : (
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold"
            style={{
              backgroundColor: store.brand_colors.primary,
              color: bannerTextColor(bannerColor(store.brand_colors.primary)),
            }}
          >
            {store.name.charAt(0).toUpperCase()}
          </div>
        )}
        <Heading className="text-3xl font-bold break-words">
          {store.name}
        </Heading>
        {subtitle && (
          <p className="mx-auto mt-2 max-w-2xl whitespace-pre-line break-words">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
