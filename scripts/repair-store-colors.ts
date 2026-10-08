import {createAdminClient} from "../lib/supabase/admin";
import {PrintfulClient} from "../lib/lineup/printful";
import {extendColors} from "../lib/lineup/extend-colors";
import {effectiveTemplate} from "../lib/lineup/artwork-plan";
import {tryScheduleLineupWakeup} from "../lib/lineup/queue";
import type {GenerationJob} from "../lib/lineup/types";
async function main(){
 const storeId=process.argv[2]; if(!storeId)throw Error('Provide a store ID');
 const apply=process.argv.includes('--apply'),db=createAdminClient(),client=new PrintfulClient();
 const {data:jobs,error}=await db.from('product_generation_jobs').select('*,product_templates(active,enabled_colors)').eq('store_id',storeId).eq('status','completed');if(error)throw error;
 for(const row of jobs ?? []) {
  if(!row.product_templates?.active || !row.state?.productId)continue;
  const job=row as unknown as GenerationJob,template=effectiveTemplate(job),colors=row.product_templates.enabled_colors ?? [];
  const catalog=await client.product(job.state.productId!);
  const known=new Set(job.state.variants?.map(v=>v.id));
  const missing=catalog.variants.filter(v=>v.in_stock!==false&&colors.includes(v.color)&&!known.has(v.id));
  if(!missing.length)continue;
  const files=await client.printfiles(job.state.productId!,template.technique);
  const state=extendColors(job,catalog.variants,files,colors);
  console.log({jobId:job.id,title:template.title,missingColors:[...new Set(missing.map(v=>v.color))],missingVariants:missing.length,apply});
  if(apply&&state){
   const {error:save}=await db.from('product_generation_jobs').update({state:state as never,template_snapshot:{...job.template_snapshot,enabled_colors:colors} as never,status:'pending',attempts:0,last_error:null,available_at:new Date().toISOString(),lease_token:null,lease_until:null})
    .eq('id',job.id).eq('status','completed').eq('updated_at',row.updated_at).eq('generation_id',row.generation_id!).select('id').single();if(save)throw save;
  }
 }
 if(apply)await tryScheduleLineupWakeup();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
