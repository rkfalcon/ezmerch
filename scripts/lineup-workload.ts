import { createAdminClient } from '../lib/supabase/admin';
import { colorBatches } from '../lib/lineup/preview-first';
import type { GenerationState } from '../lib/lineup/types';
async function main() {
 const {data,error}=await createAdminClient().from('product_generation_jobs').select('template_snapshot,state,status').eq('store_id','d261d4c2-6e4c-45d7-8941-9be8cd88b4e9');
 if(error)throw error;
 let before=0,after=0;
 for(const job of data??[]){
  const s=job.state as GenerationState;if(!s.batches||!s.variants)continue;
  const colors=[...new Set(s.variants.map(v=>v.color))];
  const selected=new Set(colors.slice(0,25));
  const variants=s.variants.filter(v=>selected.has(v.color));
  const ids=new Set(variants.map(v=>v.id));
  const fresh=s.batches.map(b=>({printfile:b.printfile,variantIds:b.variantIds}));
  const capped=fresh.map(b=>({...b,variantIds:b.variantIds.filter(id=>ids.has(id))}));
  const current=colorBatches(fresh,s.variants).length;
  const limit=colorBatches(capped,variants).length;
  before+=current;after+=limit;
  console.log(JSON.stringify({product:job.template_snapshot.title,colors:colors.length,tasks:current,cappedTasks:limit,status:job.status}));
 }
 console.log(JSON.stringify({before,after,reduction:1-after/before}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
