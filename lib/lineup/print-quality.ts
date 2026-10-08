import {qualityChecks,type QualityCheck} from "./quality-checks";
import {defaultQualityPolicy,type QualityPolicy} from "./quality-policy";
import type { VisualComparison } from "./visual-comparison";
import { fitArtwork } from "./artwork";
import type { Printfile } from "./types";
export interface LogoQuality {
  visualComparison?: VisualComparison;
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  enhanced: boolean;
  reviewed: boolean;
  semiTransparent?: boolean;
  edgeSmoothingOnly?: boolean;
  transparency?: {partialPercent:number;maxSolidDistance?:number;maxClearDistance?:number;revision?:number;analysisVersion?:number;outliers?:number;partial?:number;visible?:number;outlierPercent?:number;outlierVisiblePercent?:number;maxOutlierCluster?:number;minorOutliersAccepted?:boolean;detached?:number;settings:Pick<import("./quality-policy").QualityValues,"partialPixelPercent"|"alphaLow"|"alphaHigh"|"edgeSolidPixels"|"edgeClearPixels"> & Partial<Pick<import("./quality-policy").QualityValues,"edgeOutlierPercent"|"edgeOutlierVisiblePercent"|"edgeOutlierClusterPixels">>};
  version?: number;
}
export interface PrintQualityReport {
  policy?: QualityPolicy;
  checks?: QualityCheck[];
  policyRevision?: number;
  adjustmentsExhausted?: boolean;
  status: "ready" | "review" | "blocked";
  message: string;
  areas: {
    id: number;
    widthInches: number;
    heightInches: number;
    sourceDpi: number;
    outputDpi: number;
    requiredDpi: number;
  }[];
  visualComparison?: VisualComparison;
  proofs?: { id: number; url: string }[];
  reviewedBy?: string;
  reviewedAt?: string;
}
function assessQualityDecision(
  logo: LogoQuality,
  areas: Printfile[],
  scale: number,
  placement: string,
  technique: string,
  policy: QualityPolicy = defaultQualityPolicy,
): PrintQualityReport {
  const settings=policy.values;
  const report: PrintQualityReport = {
    policyRevision:policy.revision,
    status: "ready",
    message:
      "Resolution meets this placement’s requirements. Inspect the mockup and order a sample before promoting a new design.",
    areas: [],
    ...(logo.visualComparison
      ? { visualComparison: logo.visualComparison }
      : {}),
  };
  if (
    !areas.length ||
    [logo.width, logo.height, logo.sourceWidth, logo.sourceHeight].some(
      (n) => !Number.isFinite(n) || n <= 0,
    ) ||
    areas.some((a) =>
      [a.width, a.height, a.dpi].some((n) => !Number.isFinite(n) || n <= 0),
    )
  )
    return {
      ...report,
      status: "blocked",
      message:
        "Print dimensions are unavailable. This product needs an admin review before generation.",
    };
  for (const area of [
    ...new Map(areas.map((a) => [a.printfile_id, a])).values(),
  ]) {
    const fit = fitArtwork(
      logo.width,
      logo.height,
      area.width,
      area.height,
      scale,
      placement,
    );
    const w = fit.width / area.dpi,
      h = fit.height / area.dpi;
    report.areas.push({
      id: area.printfile_id,
      widthInches: w,
      heightInches: h,
      sourceDpi: Math.floor(
        Math.min(logo.sourceWidth / w, logo.sourceHeight / h),
      ),
      outputDpi: Math.floor(Math.min(logo.width / w, logo.height / h)),
      requiredDpi: Math.max(settings.minOutputPpi, area.dpi),
    });
  }
  if (
    report.areas.some(
      (a) => a.outputDpi < a.requiredDpi || (logo.enhanced && a.sourceDpi < settings.minEnhancedSourcePpi),
    )
  )
    return {
      ...report,
      status: "blocked",
      message:
        "Better logo required for this print size. Upload a higher-resolution original, try enhancement if available, or ask an admin to reduce this template’s logo size. Enlarging very small artwork cannot restore its original detail.",
    };
  const visual = logo.visualComparison;
  // Internal screening floor for tiny lettering, not a supplier certification.
  const visualPassed =
    (visual?.version === 1 || visual?.version === 2) &&
    visual.status === "passed" &&
    visual.reasons.length === 0 &&
    (visual.smallestTextHeightFraction === null ||
      (typeof visual.smallestTextHeightFraction === "number" &&
        Number.isFinite(visual.smallestTextHeightFraction) &&
        visual.smallestTextHeightFraction > 0 &&
        visual.smallestTextHeightFraction <= 1 &&
        report.areas.every(
          (a) =>
            a.heightInches * visual.smallestTextHeightFraction! >=
            (technique === "embroidery" ? settings.embroideryTextMm : settings.printTextMm) / 25.4,
        )));
  if (visual && !visualPassed)
    return {
      ...report,
      status: "review",
      message: visual.reasons.length
        ? `Automated artwork check: ${visual.reasons.join(" ")}`
        : "The smallest lettering may be too small at this placement. VeryMerch must inspect it before publication.",
    };
  if (technique.includes("embroidery")) {
    const e = visual?.embroidery;
    // These are standard flat embroidery limits. Other techniques need their own profile.
    const stitchable =
      technique === "embroidery" &&
      visual?.version === 2 &&
      visualPassed &&
      e &&
      !e.uncertain &&
      e.flatColors &&
      e.simpleShapes &&
      e.transparentBackground &&
      Number.isInteger(e.colorCount) &&
      e.colorCount > 0 &&
      e.colorCount <= settings.embroideryColors &&
      Number.isFinite(e.minLineFraction) &&
      e.minLineFraction > 0 &&
      e.minLineFraction <= 1 &&
      (e.minGapFraction === null ||
        (Number.isFinite(e.minGapFraction) &&
          e.minGapFraction > 0 &&
          e.minGapFraction <= 1)) &&
      report.areas.every(
        (a) =>
          a.heightInches * e.minLineFraction >= settings.embroideryLineMm / 25.4 &&
          (e.minGapFraction === null ||
            a.heightInches * e.minGapFraction >= settings.embroideryGapMm / 25.4),
      );
    if (!stitchable)
      return {
        ...report,
        status: "review",
        message:
          "Automatic embroidery checks could not confirm suitable lettering, line thickness, gaps, and solid colors at this size. VeryMerch will handle this product; resolution alone does not establish stitchability.",
      };
  }
  if (!visualPassed && report.areas.some((a) => a.sourceDpi < a.requiredDpi))
    return {
      ...report,
      status: "review",
      message:
        "The prepared file meets the pixel requirement, but the original image has less detail than the target resolution at this size. Upscaling cannot verify lettering or recover missing detail. VeryMerch must inspect the prepared artwork before publication.",
    };
  if (
    (logo.enhanced && !logo.reviewed && !visualPassed) ||
    (settings.reviewTransparency && logo.semiTransparent &&
      (technique.includes("embroidery") || !settings.allowEdgeSmoothing || logo.edgeSmoothingOnly !== true))
  )
    return {
      ...report,
      status: "review",
      message:
        "Review artwork at the sizes below for altered lettering, fine edges and partially transparent details. Soft transparency may print differently on fabric. Confirm the design is suitable before continuing.",
    };
  if (visualPassed)
    report.message =
      "Automated image comparison and placement checks passed. No manual approval is required. Physical print results can still vary.";
  return report;
}
export function assessPrintQuality(logo:LogoQuality,areas:Printfile[],scale:number,placement:string,technique:string,policy:QualityPolicy=defaultQualityPolicy):PrintQualityReport {
 const report=assessQualityDecision(logo,areas,scale,placement,technique,policy);
 return {...report,policy:{revision:policy.revision,values:{...policy.values}},checks:qualityChecks(logo,report,policy,technique)};
}
export class PrintQualityError extends Error {
  constructor(public report: PrintQualityReport) {
    super(report.message);
  }
}
