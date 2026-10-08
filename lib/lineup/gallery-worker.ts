import {createAdminClient} from '../supabase/admin';
import {fulfillmentConnection} from '../printful-connection';
import {lineupFetch} from './request';
import {PrintfulClient, PrintfulError} from './printful';
import {effectiveTemplate} from './artwork-plan';
import {colorBatches} from './preview-first';
import {downloadMockup} from './worker';
import {copyMockupChunk} from './mockup-copy';
import {galleryImages, galleryStyles, type GalleryImage} from './gallery';
import type {GenerationJob, MockupBatch} from './types';

type Batch = MockupBatch & {gallery?:GalleryImage[]; copied?:GalleryImage[]};
interface GalleryState {styles?:string[];batches?:Batch[];unavailable?:boolean}
interface GalleryJob {id:string;source_job:string;product_id:string;generation_id:string;source_revision:string;lease_token:string;attempts:number;state:GalleryState}

export async function runProductGalleryWorker(budgetMs=20_000) {
 if(process.env.BACKGROUND_JOBS_PAUSED==='true' || (await fulfillmentConnection()).paused) return {galleryProcessed:0};
 const db=createAdminClient(lineupFetch),client=new PrintfulClient(lineupFetch);
 const started=Date.now();let processed=0;
 while(processed<4 && Date.now()-started<budgetMs){
  const {data,error}=await db.rpc('claim_product_gallery_job');if(error)throw error;
  const job=data?.[0] as GalleryJob|undefined;if(!job)break;
  const save=async(complete=false,delay=0)=>{
   const {error}=await db.rpc('save_product_gallery_job',{p_job:job.id,p_lease:job.lease_token,p_state:job.state,
    p_images:job.state.batches?.flatMap(b=>b.gallery??b.copied??[])??[],p_complete:complete,p_delay_ms:delay});
   if(error)throw error;
  };
  try{
   const {data:source,error:se}=await db.from('product_generation_jobs').select('*').eq('id',job.source_job).single();if(se)throw se;
   const generation=source as GenerationJob;
   const template=effectiveTemplate(generation),state=generation.state;
   if(!state.productId || !state.variants || !state.batches)throw Error('Source artwork is unavailable');
   if(!job.state.batches){
    const files=await client.printfiles(state.productId,template.technique);
    const styles=galleryStyles(template.category,files.option_groups??[],template.option_groups??[]);
    job.state.styles=styles;
    if(!styles.length){job.state.unavailable=true;await save(true);processed++;continue;}
    const {data:product,error:pe}=await db.from('products').select('variants,global_enabled_colors').eq('id',job.product_id).single();if(pe)throw pe;
    const ids=new Set((product.variants as {variant_id:number}[]).map(v=>v.variant_id));
    const variants=state.variants.filter(v=>ids.has(v.id)&&(!product.global_enabled_colors||product.global_enabled_colors.includes(v.color)));
    const allowed=new Set(variants.map(v=>v.id));
    const batches=colorBatches(state.batches.map(b=>({...b,variantIds:b.variantIds.filter(id=>allowed.has(id))})),variants,product.global_enabled_colors);
    job.state.batches=batches.map((b,index)=>({...b,assetKey:String(index),artworkUrl:state.batches!.find(s=>s.printfile.printfile_id===b.printfile.printfile_id&&s.artworkUrl)?.artworkUrl}));
    await save(!batches.length);
   }else{
    const batch=job.state.batches.find(b=>!b.gallery);
    if(!batch){await save(true);processed++;continue;}
    if(!batch.artworkUrl)throw Error('Prepared artwork missing');
    if(!batch.taskKey){
     // Extra views yield supplier submission capacity to primary product generation.
     const {count,error:qe}=await db.from('product_generation_jobs').select('id,product_templates!inner(active)',{head:true,count:'exact'})
      .in('status',['pending','running']).eq('product_templates.active',true).lte('available_at',new Date(Date.now()+60_000).toISOString());if(qe)throw qe;
     if(count){await save(false,60_000);processed++;continue;}
     const {data:wait,error:we}=await db.rpc('reserve_lineup_mockup_slot');if(we||typeof wait!=='number')throw we??Error('Mockup pacing unavailable');
     if(wait>0){await save(false,wait);processed++;continue;}
     const result=await client.createMockup(state.productId,batch,{...template,option_groups:job.state.styles!});
     if(!result.task_key)throw Error('No gallery task returned');
     batch.taskKey=result.task_key;batch.taskStartedAt=new Date().toISOString();
     if(client.mockupCooldownMs>0){const {error}=await db.rpc('defer_lineup_mockup_slot',{p_delay_ms:client.mockupCooldownMs});if(error)throw error;}
     await save(false,15_000);
    }else{
     const result=await client.poll(batch.taskKey);
     if(result.status==='failed'){delete batch.taskKey;delete batch.copied;throw Error(result.error??'Gallery render failed');}
     if(result.status!=='completed'){
      if(Date.now()-Date.parse(batch.taskStartedAt??'')>30*60_000){delete batch.taskKey;delete batch.copied;throw Error('Gallery rendering timed out');}
      await save(false,15_000);processed++;continue;
     }
     const images=galleryImages(result.mockups??[],job.state.styles!,batch.representatives!,template.placement);
     if(!images.length)throw Error('No requested gallery images returned');
     const copied=batch.copied??[];
     copied.push(...await copyMockupChunk(images,copied.length,async(image,index)=>{
      const bytes=await downloadMockup(image.url);
      const path=`${generation.store_id}/gallery-${job.id}/views-v2/${job.generation_id}-${job.source_revision}/${batch.assetKey}-${index}.jpg`;
      const {error}=await db.storage.from('lineup-assets').upload(path,bytes,{contentType:'image/jpeg',upsert:true});if(error)throw error;
      return {...image,url:db.storage.from('lineup-assets').getPublicUrl(path).data.publicUrl};
     }));
     batch.copied=copied;
     if(copied.length===images.length){batch.gallery=copied;delete batch.copied;}
     await save(job.state.batches.every(b=>!!b.gallery));
    }
   }
  }catch(error){
   const rateLimited=error instanceof PrintfulError&&error.status===429;
   const attempts=job.attempts+(rateLimited?0:1);
   const delay=rateLimited?error.retryAfterMs:Math.min(30*60_000,60_000*2**attempts);
   const {error:saveError}=await db.from('product_gallery_jobs').update({state:job.state,attempts,status:attempts>=5?'failed':'pending',
    last_error:(error instanceof Error?error.message:'Gallery failed').slice(0,700),available_at:new Date(Date.now()+delay).toISOString(),lease_token:null,lease_until:null,updated_at:new Date().toISOString()}).eq('id',job.id).eq('lease_token',job.lease_token);
   if(saveError)throw saveError;
   console.error('gallery.step_failed',{id:job.id,message:error instanceof Error?error.message:'Unknown'});
   if(rateLimited){await db.rpc('defer_lineup_mockup_slot',{p_delay_ms:delay});break;}
  }
  processed++;
 }
 return {galleryProcessed:processed};
}
