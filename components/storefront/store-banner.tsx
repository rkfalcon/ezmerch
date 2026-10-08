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
      className="py-5 text-center sm:py-8"
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
            className="mx-auto mb-2 h-10 w-10 object-contain sm:h-14 sm:w-14 sm:mb-3"
          />
        ) : (
          <div
            className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold sm:h-14 sm:w-14 sm:mb-3 sm:text-2xl"
            style={{
              backgroundColor: store.brand_colors.primary,
              color: bannerTextColor(bannerColor(store.brand_colors.primary)),
            }}
          >
            {store.name.charAt(0).toUpperCase()}
          </div>
        )}
        <Heading className="text-xl font-bold break-words sm:text-2xl">
          {store.name}
        </Heading>
        {subtitle && (
          <p className="mx-auto mt-1 max-w-2xl whitespace-pre-line break-words text-xs leading-5 sm:mt-2 sm:text-sm">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
