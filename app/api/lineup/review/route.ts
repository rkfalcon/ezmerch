import {cachedReviewImage, reviewFingerprint, type ReviewMockupCache} from "@/lib/lineup/review-mockup-cache";
import {lineupStoreAccess} from "@/lib/lineup/access";
import {actualSizeReviewPdf} from "@/lib/lineup/review-pdf";
import {PrintfulClient, PrintfulError} from "@/lib/lineup/printful";
import {effectiveTemplate} from "@/lib/lineup/artwork-plan";
import type {GenerationJob} from "@/lib/lineup/types";

export const maxDuration=60;

async function reviewJob(storeId:string,jobId:string){
 const {db,user}=await lineupStoreAccess(storeId);
 if(!user.isAdmin) throw new Error("Admin access required");
 const {data,error}=await db.from("product_generation_jobs").select("*").eq("store_id",storeId).eq("id",jobId).single();
 if(error||!data)throw new Error("Design unavailable");
 return {db,job:data as GenerationJob,cache:data.review_mockup as ReviewMockupCache};
}
export async function GET(request:Request){
 try{
  const p=new URL(request.url).searchParams;
  const {db,job}=await reviewJob(p.get("storeId")??"",p.get("jobId")??"");
  if(effectiveTemplate(job).technique.includes("embroidery"))throw new Error("Embroidery reviews use the Printful mockup, not a PDF.");
  const id=Number(p.get("area"));
  const batch=job.state.batches?.find(b=>b.printfile.printfile_id===id);
  const proof=job.state.printQuality?.proofs?.find(p=>p.id===id);
  if(!batch||!proof)throw new Error("Prepared artwork is not available yet");
  const url=new URL(proof.url);
  const prefix="/storage/v1/object/public/lineup-assets/";
  const path=decodeURIComponent(url.pathname.slice(prefix.length));
  if(url.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin ||
     !url.pathname.startsWith(prefix)||!path.startsWith(job.store_id+"/")||path.includes(".."))
    throw new Error("Invalid artwork location");
  const {data,error}=await db.storage.from("lineup-assets").download(path);
  if(error||!data)throw new Error("Prepared artwork unavailable");
  const pdf=await actualSizeReviewPdf(Buffer.from(await data.arrayBuffer()),batch.printfile.dpi);
  return new Response(Buffer.from(pdf),{headers:{"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="verymerch-actual-size-review.pdf"',"Cache-Control":"private, no-store"}});
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Review unavailable"},{status:400});}
}
export async function POST(request:Request){
 try{
  const {storeId,jobId}=await request.json();
  const {db,job,cache}=await reviewJob(storeId,jobId);
  if(job.status!=="failed")throw new Error("Refresh: this design is no longer held for review.");
  const client=new PrintfulClient();
  const fingerprint=reviewFingerprint(job);
  const image=cachedReviewImage(job,cache);
  if(image)return Response.json({status:"completed",mockups:[{mockup_url:image}]});
  const save=async(value:ReviewMockupCache,expected:ReviewMockupCache=cache)=>{
    let query=db.from("product_generation_jobs").update({review_mockup:value})
      .eq("id",job.id).eq("status","failed").eq("review_mockup",JSON.stringify(expected));
    query=job.generation_id?query.eq("generation_id",job.generation_id):query.is("generation_id",null);
    const {data,error}=await query.select("id").maybeSingle();
    if(error)throw error;
    return !!data;
  };
  if(cache.fingerprint===fingerprint && cache.taskKey && !cache.image && (cache.leaseUntil??0)>Date.now()){
   const result=await client.poll(cache.taskKey);
   if(result.status==="completed"){
    const image=result.mockups?.[0]?.mockup_url;
    if(!image)throw new Error("Printful completed without an image.");
    if(!await save({fingerprint,image,completedAt:Date.now()}))return Response.json({status:"pending"});
   }else if(result.status==="failed"){
    await save({});
    throw new Error(result.error||"Printful could not render the embroidery preview.");
   }
   return Response.json(result);
  }
  if(cache.fingerprint===fingerprint && (cache.leaseUntil??0)>Date.now())
    return Response.json({status:"pending"});
  const batch=job.state.batches?.find(b=>b.artworkUrl);
  if(!batch||!job.state.productId)throw new Error("Run automatic checks to prepare a print file first.");
  // Do not consume a slot intended for the first approved colors.
  const {data:urgent,error:urgentError}=await db.from("product_generation_jobs").select("id,published:state->publishedVariantCount,quality:state->printQuality->>status,reviewed:state->printQuality->>reviewedAt,technique:template_snapshot->>technique,product_templates!inner(active)").eq("product_templates.active",true).in("status",["pending","running"]).lte("available_at",new Date(Date.now()+300000).toISOString()).limit(1000);
  if(urgentError)throw urgentError;
  if(urgent?.some(j=>!Number(j.published) && (j.technique !== "embroidery" || j.quality === "ready" || j.reviewed)))return Response.json({error:"First product colors are being prepared. Try this optional review mockup after they are ready."},{status:409});
  const {data:wait,error}=await db.rpc("reserve_lineup_mockup_slot");
  if(error || typeof wait !== "number")throw new Error("Could not reserve a Printful request slot");
  if(wait>0)return Response.json({error:"Printful is busy. Try again shortly.",retryAfterMs:wait},{status:429});
  const reserved={fingerprint,leaseUntil:Date.now()+90000};
  if(!await save(reserved))return Response.json({status:"pending"});
  let task;
  try {
    task=await client.createMockup(job.state.productId,{...batch,variantIds:[batch.variantIds[0]],representatives:undefined},effectiveTemplate(job));
  } catch(error) {
    await save({},reserved);
    if(error instanceof PrintfulError && error.status===429){
      await db.rpc("defer_lineup_mockup_slot",{p_delay_ms:error.retryAfterMs});
      return Response.json({error:"Printful requested a pause. Try again shortly.",retryAfterMs:error.retryAfterMs},{status:429});
    }
    throw error;
  }
  if(!task.task_key) { await save({},reserved); throw new Error("Printful did not return a preview task."); }
  if(!await save({fingerprint,taskKey:task.task_key,leaseUntil:Date.now()+1800000},reserved))return Response.json({status:"pending"});
  if(client.mockupCooldownMs)await db.rpc("defer_lineup_mockup_slot",{p_delay_ms:client.mockupCooldownMs});
  return Response.json(task);
 }catch(error){return Response.json({error:error instanceof Error?error.message:"Mockup unavailable"},{status:400});}
}
