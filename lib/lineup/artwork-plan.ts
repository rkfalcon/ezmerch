import {defaultQualityPolicy,type QualityPolicy} from "./quality-policy";
import { assessPrintQuality, type LogoQuality } from "./print-quality";
import { leftChestPlacement } from "./placement";
import type { GenerationJob, Printfile, ProductTemplate } from "./types";

export function effectiveTemplate(job: GenerationJob): ProductTemplate {
  return { ...job.template_snapshot, ...job.state.artworkPlan };
}

/** Search bounded sizes in the existing print area; preserve aspect ratio and logo identity.
 * Prefer a passing size over a closer size needing review. No additional AI/supplier calls.
 */
export function planArtwork(
  logo: LogoQuality,
  areas: Printfile[],
  template: ProductTemplate,
  policy: QualityPolicy = defaultQualityPolicy,
) {
  const preferred = {
    scale: Number(template.scale),
    placement: template.placement,
  };
  const assess = (plan: typeof preferred) =>
    assessPrintQuality(
      logo,
      areas,
      plan.scale,
      plan.placement,
      template.technique,
      policy,
    );
  const quality = assess(preferred);
  if (quality.status === "ready") return { plan: preferred, quality };
  const sizes = Array.from({ length: 100 }, (_, i) => (100 - i) / 100);
  const candidates = [
    // Largest passing size first, within the admin's intended maximum.
    ...Array.from({ length: 100 }, (_, i) => ({
      ...preferred,
      scale: (100 - i) / 100,
    })).filter((p) => p.scale < preferred.scale && p.scale >= (template.technique === "dtg" ? policy.values.minDtgScalePercent / 100 : preferred.scale * policy.values.minOtherScalePercent / 100)),
    // Grow within the same print area when shrinking cannot make lettering readable.
    ...((["embroidery", "dtg"].includes(template.technique) || policy.values.growOtherPrints)
      ? Array.from({ length: 100 }, (_, i) => ({ ...preferred, scale: (i + 1) / 100 }))
          .filter((p) => p.scale > preferred.scale)
      : []),
    ...(template.technique === "dtg" && template.allow_front_fallback && ["front", leftChestPlacement].includes(template.placement)
      ? sizes.map(scale => ({ placement: template.placement === "front" ? leftChestPlacement : "front", scale }))
      : []),
  ];
  let fallback = { plan: preferred, quality };
  for (const plan of candidates) {
    const candidate = assess(plan);
    if (candidate.status === "blocked") continue;
    // Left-chest is an optional location change, never a way to produce a tiny logo.
    if (
      (plan.placement !== preferred.placement || (template.technique === "dtg" && ["front", leftChestPlacement].includes(plan.placement))) &&
      candidate.areas.some((a) => Math.max(a.widthInches, a.heightInches) < policy.values.minFrontInches)
    )
      continue;
    const result = {
      plan,
      quality: {
        ...candidate,
        message: `Automatic placement prepared (${plan.placement}, ${Math.round(plan.scale * 100)}% scale). ${candidate.message}`,
      },
    };
    if (candidate.status === "ready") return result;
    if (fallback.quality.status === "blocked") fallback = result;
  }
  return { ...fallback, quality: { ...fallback.quality, adjustmentsExhausted: true, message: "Automatic size and permitted placement adjustments could not resolve this concern. " + fallback.quality.message } };
}
