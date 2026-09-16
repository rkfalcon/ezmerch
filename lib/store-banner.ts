export const defaultBannerSubtitle =
  "Shop our collection of custom merchandise";
export const isBannerColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export function bannerColor(color?: string | null, primary?: string) {
  if (color && isBannerColor(color)) return color;
  // Match the original primary color at 16/255 opacity over white.
  const base = primary && isBannerColor(primary) ? primary : "#000000";
  return (
    "#" +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          (parseInt(base.slice(offset, offset + 2), 16) * 16) / 255 + 239,
        )
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function bannerTextColor(background: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(background.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function validateBannerSettings(color: unknown, subtitle: unknown) {
  if (typeof color !== "string" || !isBannerColor(color))
    throw new Error("Choose a valid banner color, such as #153D32.");
  if (typeof subtitle !== "string" || subtitle.length > 240)
    throw new Error("Keep the banner text to 240 characters or fewer.");
  return {
    banner_color: color.toLowerCase(),
    banner_subtitle: subtitle.trim(),
  };
}
