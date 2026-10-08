/** Read-only inspection of the Sunday Sauce review and production-size PDF. */
import {createAdminClient} from "../lib/supabase/admin";
import {actualSizeReviewPdf} from "../lib/lineup/review-pdf";
import {planArtwork} from "../lib/lineup/artwork-plan";
import {writeFileSync} from "node:fs";
async function main(){
 const db=createAdminClient();
 const {data:job,error}=await db.from("product_generation_jobs").select("*").eq("store_id","d261d4c2-6e4c-45d7-8941-9be8cd88b4e9").ilike("template_snapshot->>title","%Garment-Dyed%").single();
 if(error)throw error;
 const {data:meta,error:me}=await db.storage.from("lineup-assets").download(job.logo_path+".json");if(me||!meta)throw me;
 const metadata=JSON.parse(await meta.text());
 const prepared=planArtwork(metadata,job.state.batches.map((b:{printfile:unknown})=>b.printfile),{...job.template_snapshot,allow_front_fallback:true});
 console.log(JSON.stringify({jobId:job.id,status:prepared.quality.status,plan:prepared.plan,areas:prepared.quality.areas},null,2));
 const proof=job.state.printQuality.proofs[0];
 const path=new URL(proof.url).pathname.split("/lineup-assets/")[1];
 const {data:art,error:ae}=await db.storage.from("lineup-assets").download(path);if(ae||!art)throw ae;
 writeFileSync("/tmp/ez-sunday-actual-size.pdf",await actualSizeReviewPdf(Buffer.from(await art.arrayBuffer()),job.state.batches[0].printfile.dpi));
}
main().catch(e=>{console.error(e);process.exitCode=1});
