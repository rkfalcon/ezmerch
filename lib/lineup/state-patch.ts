import { isDeepStrictEqual } from "node:util";
import type { GenerationState } from "./types";

/** Replace changed batches, without resending the immutable variant catalog. */
export function generationStatePatch(
  before: GenerationState,
  after: GenerationState,
) {
  const patch: Record<string, unknown> = {};
  const batches: Record<string, unknown> = {};
  const remove = Object.keys(before).filter((key) => !(key in after));
  for (const key of Object.keys(after) as (keyof GenerationState)[]) {
    if (isDeepStrictEqual(before[key], after[key])) continue;
    if (after[key] === undefined) {
      remove.push(key);
      continue;
    }
    if (
      key === "batches" &&
      before.batches &&
      after.batches &&
      before.batches.length === after.batches.length
    ) {
      after.batches.forEach((batch, index) => {
        if (!isDeepStrictEqual(before.batches![index], batch))
          batches[String(index)] = batch;
      });
    } else patch[key] = after[key];
  }
  return { patch, batches, remove };
}
