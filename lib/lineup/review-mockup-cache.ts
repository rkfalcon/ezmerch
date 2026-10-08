import {createHash} from "node:crypto";
import {effectiveTemplate} from "./artwork-plan";
import type {GenerationJob} from "./types";
export interface ReviewMockupCache {
 fingerprint?:string;taskKey?:string;image?:string;completedAt?:number;leaseUntil?:number;
}
export function reviewFingerprint(job:GenerationJob){
 const batch=job.state.batches?.find(b=>b.artworkUrl);
 return createHash("sha256").update(JSON.stringify({
  generation:job.generation_id,logo:job.logo_path,plan:effectiveTemplate(job),
  artwork:batch?.artworkUrl,variant:batch?.variantIds[0],area:batch?.printfile,
 })).digest("hex");
}
export function cachedReviewImage(job:GenerationJob,cache:ReviewMockupCache,now=Date.now()){
 return cache.fingerprint===reviewFingerprint(job)&&cache.image&&cache.completedAt&&now-cache.completedAt<86400000?cache.image:null;
}
