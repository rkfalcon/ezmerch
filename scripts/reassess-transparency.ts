/** Reanalyze original pixels and retry untouched quality holds, without manual approval. */
import sharp from 'sharp';
import {createAdminClient} from '../lib/supabase/admin';
import {readLogo} from '../lib/lineup/prepared-logo';
import {imageHash} from '../lib/lineup/visual-comparison';
import {analyzeTransparency} from '../lib/lineup/logo-transparency';
import {loadQualityPolicy} from '../lib/lineup/quality-policy-store';
import {resetReview} from '../lib/lineup/review-adjustment';
import {planArtwork} from '../lib/lineup/artwork-plan';
import type {LogoQuality} from '../lib/lineup/print-quality';
import type {GenerationJob} from '../lib/lineup/types';
async function main(){
 const storeId=process.argv[2],apply=process.argv.includes('--apply');
 if(!/^[\da-f-]{36}$/i.test(storeId??''))throw Error('Provide store UUID');
 const db=createAdminClient(),policy=await loadQualityPolicy(db);
 const {data:store,error}=await db.from('stores').select('owner_id,lineup_logo_path').eq('id',storeId).single();if(error)throw error;
 const path=store.lineup_logo_path;
 const preparationId=/quality-v4-([\da-f-]{36})-/.exec(path)?.[1];
 if(!preparationId)throw Error('Cannot identify original preparation');
 const {data:prep,error:pe}=await db.from('logo_preparations').select('id').eq('id',preparationId).eq('user_id',store.owner_id).single();if(pe||!prep)throw pe??Error('Preparation owner mismatch');
 const original=await readLogo(db,`${store.owner_id}/${preparationId}/clean.png`);
 const {data:sidecar,error:se}=await db.storage.from('lineup-assets').download(`${path}.json`);if(se||!sidecar)throw se??Error('Missing quality metadata');
 const metadata=JSON.parse(await sidecar.text()) as LogoQuality;
 if(metadata.visualComparison?.sourceHash!==imageHash(original))throw Error('Original source hash mismatch');
 const pixels=await sharp(original).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 Object.assign(metadata,analyzeTransparency(pixels.data,pixels.info.width,pixels.info.height,policy.values));
 if(metadata.transparency)metadata.transparency.revision=policy.revision;
 console.log({storeId,revision:policy.revision,edgeException:metadata.edgeSmoothingOnly,measurements:metadata.transparency});
 const {data:rows,error:je}=await db.from('product_generation_jobs').select('*').eq('store_id',storeId).eq('logo_path',path).eq('status','failed');if(je)throw je;
 // Validate every reset before changing the stored analysis.
 const jobs=(rows as (GenerationJob & {updated_at:string})[]).filter(j=>j.state.printQuality);
 const resets=jobs.map(j=>({job:j,reset:resetReview(j.state,j.template_snapshot)}));
 if(apply){const {error}=await db.storage.from('lineup-assets').upload(`${path}.json`,Buffer.from(JSON.stringify(metadata)),{contentType:'application/json',upsert:true});if(error)throw error;}
 for(const {job,reset} of resets){
  const result=job.state.batches?.length?planArtwork(metadata,job.state.batches.map(b=>b.printfile),reset.template,policy).quality:null;
  console.log({product:job.template_snapshot.title,assessment:result?.status,remainingReviews:result?.checks?.filter(c=>c.result==='review').map(c=>c.label)});
  if(!apply)continue;
  const {data,error}=await db.from('product_generation_jobs').update({state:reset.state,template_snapshot:reset.template,generation_id:crypto.randomUUID(),status:'pending',attempts:0,last_error:null,lease_token:null,lease_until:null,available_at:new Date().toISOString()})
   .eq('id',job.id).eq('status','failed').eq('logo_path',path).eq('updated_at',job.updated_at).select('id');
  if(error||data?.length!==1)throw error??Error('Job changed during reassessment');
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
