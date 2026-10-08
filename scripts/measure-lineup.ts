import {createAdminClient} from '../lib/supabase/admin';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
async function main(){
 const report=JSON.parse(readFileSync('/tmp/ez-lineup-live-test.json','utf8'));
 const db=createAdminClient();
 const {data,error}=await db.from('product_generation_jobs').select('id,status,quick_preview_url,published:state->publishedVariantCount,title:template_snapshot->>title,last_error,updated_at').eq('store_id',report.storeId);if(error)throw error;
 const now=Date.now();const file='/tmp/ez-lineup-milestones.json';
 const events=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{};
 const summary=(data??[]).map(job=>{
  const record=events[job.id]??={title:job.title};
  if(job.quick_preview_url&&!record.preview)record.preview=(now-report.start)/1000;
  if((Number(job.published)>0||job.status==='completed')&&!record.firstColor)record.firstColor=(now-report.start)/1000;
  if(job.status==='completed'&&!record.complete)record.complete=(now-report.start)/1000;
  if(job.status==='failed'&&!record.held)record.held=(now-report.start)/1000;
  return {title:job.title,status:job.status,preview:!!job.quick_preview_url,published:job.published,error:job.last_error};
 });
 writeFileSync(file,JSON.stringify(events,null,2));console.log(JSON.stringify({elapsedSeconds:(now-report.start)/1000,jobs:summary},null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
