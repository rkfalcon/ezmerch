import { colorBatches } from "./preview-first";
import { groupPrintfiles } from "./printful";
import { effectiveTemplate } from "./artwork-plan";
import type { CatalogVariant, GenerationJob, Printfiles } from "./types";

/** Extend the same approved artwork without invalidating already saleable colors. */
export function extendColors(job: GenerationJob, catalog: CatalogVariant[], files: Printfiles, colors: string[]) {
  const state = job.state;
  if (job.status !== "completed" || !state.variants?.length || !state.batches?.length)
    throw Error("Only completed generations can be extended");
  if (state.printQuality && state.printQuality.status !== "ready" && !state.printQuality.reviewedAt)
    throw Error("Artwork must be approved before adding colors");
  const known = new Set(state.variants.map(v => v.id));
  const missing = catalog.filter(v => v.in_stock !== false && colors.includes(v.color) && !known.has(v.id));
  if (!missing.length) return null;
  const grouped = groupPrintfiles(files, missing.map(v => v.id), effectiveTemplate(job).placement);
  if (grouped.some(b => !state.batches!.some(old => old.printfile.printfile_id === b.printfile.printfile_id && old.printfile.width === b.printfile.width && old.printfile.height === b.printfile.height && old.printfile.dpi === b.printfile.dpi)))
    throw Error("New print areas require a fresh artwork assessment");
  return {...state, variants:[...state.variants,...missing], batches:[...state.batches,...colorBatches(grouped,missing,colors)], progressive:true};
}
