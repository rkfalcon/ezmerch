import {createAdminClient} from '../lib/supabase/admin';
import {PrintfulClient} from '../lib/lineup/printful';
import {instantPreview} from '../lib/lineup/instant-preview';
import {previewMetadata} from '../lib/lineup/preview-cache';
import {effectiveTemplate} from '../lib/lineup/artwork-plan';
import type {GenerationJob} from '../lib/lineup/types';
async function main(){
 const db=createAdminClient();const client=new PrintfulClient();
 const {data,error}=await db.from('product_generation_jobs').select('*').eq('store_id','d261d4c2-6e4c-45d7-8941-9be8cd88b4e9').eq('status','completed');if(error)throw error;
 const job=data!.find(j=>j.template_snapshot.title.includes('3001')) as GenerationJob;
 const {data:logo,error:logoError}=await db.storage.from('lineup-assets').download(job.logo_path);if(logoError||!logo)throw Error('Logo missing');
 const bytes=Buffer.from(await logo.arrayBuffer());const template=effectiveTemplate(job);
 for(let i=0;i<2;i++){
  const started=Date.now();const id=job.state.productId!;
  await previewMetadata(db,`catalog:${id}`,()=>client.product(id));
  await previewMetadata(db,`printfiles:${id}:${template.technique}`,()=>client.printfiles(id,template.technique));
  const url=await instantPreview(db,client,id,job.state.variants![0].id,template,bytes,job.store_id,'preview-benchmark',true);
  console.log({run:i+1,previewProduced:!!url,elapsedMs:Date.now()-started});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
