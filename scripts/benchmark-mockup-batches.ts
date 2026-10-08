import { createAdminClient } from '../lib/supabase/admin';
import { PrintfulClient } from '../lib/lineup/printful';
import { effectiveTemplate } from '../lib/lineup/artwork-plan';
import type { GenerationJob } from '../lib/lineup/types';
import { readFileSync,writeFileSync } from 'node:fs';
async function main(){
 const file='/tmp/ez-mockup-benchmark.json';
 const client=new PrintfulClient();
 if(process.argv[2]==='poll'){
  const runs=JSON.parse(readFileSync(file,'utf8'));
  for(const run of runs){const result=await client.poll(run.key);console.log({colors:run.colors,status:result.status,images:result.mockups?.length,elapsedSeconds:Math.round((Date.now()-run.started)/1000)});}
  return;
 }
 const colors=Number(process.argv[2]);if(![5,10].includes(colors))throw Error('Use 5, 10, or poll');
 const db=createAdminClient();
 const {data,error}=await db.from('product_generation_jobs').select('*').eq('store_id','d261d4c2-6e4c-45d7-8941-9be8cd88b4e9').eq('status','completed');if(error)throw error;
 const job=data?.find(j=>j.template_snapshot.catalog_match==='3001'||j.template_snapshot.title.includes('3001')) as GenerationJob;
 if(!job)throw Error('Completed staple shirt missing');
 const source=job.state.batches!.find(b=>b.artworkUrl)!;
 const representatives=job.state.batches!.filter(b=>b.printfile.printfile_id===source.printfile.printfile_id).flatMap(b=>b.representatives??[]).slice(0,colors);
 const {data:wait,error:paceError}=await db.rpc('reserve_lineup_mockup_slot');if(paceError)throw paceError;if(wait>0)throw Error(`Retry after ${wait}ms`);
 const started=Date.now();
 const result=await client.createMockup(job.state.productId!,{...source,representatives,variantIds:representatives.flatMap(r=>r.variantIds)},effectiveTemplate(job));
 let runs=[];try{runs=JSON.parse(readFileSync(file,'utf8'));}catch{}
 runs.push({colors,started,key:result.task_key});writeFileSync(file,JSON.stringify(runs));
 console.log({colors,submitted:true,requestMs:Date.now()-started});
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
