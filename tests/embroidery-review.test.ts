import test from "node:test";
import assert from "node:assert/strict";
import {cachedReviewImage,reviewFingerprint} from "../lib/lineup/review-mockup-cache";
import type {GenerationJob} from "../lib/lineup/types";
const job={id:"job",generation_id:"generation",logo_path:"logo",template_snapshot:{technique:"embroidery",scale:.8,placement:"embroidery_front"},
 state:{batches:[{artworkUrl:"proof",variantIds:[1],printfile:{printfile_id:1,width:100,height:100,dpi:150}}]}} as GenerationJob;
test("review image is bound to generation, artwork, variant and placement, and expires",()=>{
 const cache={fingerprint:reviewFingerprint(job),image:"mockup",completedAt:100};
 assert.equal(cachedReviewImage(job,cache,101),"mockup");
 assert.equal(cachedReviewImage({...job,generation_id:"next"},cache,101),null);
 assert.equal(cachedReviewImage({...job,state:{...job.state,artworkPlan:{scale:.9,placement:"embroidery_front"}}},cache,101),null);
 assert.equal(cachedReviewImage(job,cache,86400200),null);
});
