import test from 'node:test';
import assert from 'node:assert/strict';
import { jobPreview } from '../lib/lineup/job-preview';
import type { MockupBatch } from '../lib/lineup/types';
const template = {scale: .8, placement: 'front'};
const plan = {scale: .4, placement: 'front'};
test('real mockup replaces quick previews even while remaining variants generate', () => {
  const state = {artworkPlan: plan, instantPreview:'prepared', batches:[{images:[{url:'real',variant_ids:[1]}]} as MockupBatch]};
  assert.deepEqual(jobPreview(state,template,'old'),{image:'real',imageKind:'mockup'});
});
test('adjusted placement hides legacy previews and uses only a matching prepared preview',()=>{
  assert.equal(jobPreview({artworkPlan:plan,instantPreview:'legacy'},template,'old').image,null);
  assert.equal(jobPreview({artworkPlan:plan,instantPreview:'prepared',instantPreviewPlan:plan},template,'old').image,'prepared');
  assert.equal(jobPreview({artworkPlan:plan,instantPreview:'stale',instantPreviewPlan:template},template,'old').image,null);
  assert.equal(jobPreview({},template,'early').image,'early');
});
test('embroidery derivative never falls back to original logo preview',()=>{
  assert.equal(jobPreview({embroideryLogoPath:'derived'},template,'original').image,null);
});
test('quick preview matches assessed placement before supplier mockup exists',()=>{
 assert.equal(jobPreview({artworkPlan:plan},template,'prepared',plan).image,'prepared');
 assert.equal(jobPreview({artworkPlan:plan},template,'old',template).image,null);
});
