import test from "node:test";
import assert from "node:assert/strict";
import { jobProgress } from "../lib/lineup/job-progress";
import type { GenerationState } from "../lib/lineup/types";
const state = {
  variants: [{id:1,color:"Black"},{id:2,color:"Black"},{id:3,color:"White"}],
  batches: [{variantIds:[1,2],images:[{url:"image",variant_ids:[1,2]}]}],
} as GenerationState;
test("a rendered mockup is not presented as a published first color", () => {
  assert.deepEqual(jobProgress(state,"pending"), {stage:"Preview ready · Preparing product for sale",firstPublished:false,readyColors:1,totalColors:2});
});
test("publication reports remaining colors even while job is queued", () => {
  const progress=jobProgress({...state,publishedVariantCount:2},"pending");
  assert.equal(progress.firstPublished,true);
  assert.equal(progress.stage,"First color ready · Preparing remaining colors");
});
test("partial sizes do not inflate color readiness", () => {
  assert.equal(jobProgress({...state,batches:[{...state.batches![0],images:[{url:"image",variant_ids:[1]}]}]},"running").readyColors,0);
});
test("new generation does not inherit publication from preliminary previews", () => {
  assert.equal(jobProgress({instantPreview:"approximate"},"pending").firstPublished,false);
  assert.equal(jobProgress({},"completed").firstPublished,true);
});
