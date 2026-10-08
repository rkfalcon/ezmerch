/** Recheck existing, unpublished quality holds without running supplier jobs. */
import { createAdminClient } from '../lib/supabase/admin';
import { advanceJob } from '../lib/lineup/worker';
import { PrintfulClient } from '../lib/lineup/printful';
import { PrintQualityError } from '../lib/lineup/print-quality';
import type { GenerationJob } from '../lib/lineup/types';
async function main() {
  const storeId = process.argv[2];
  if (!storeId || !/^[\da-f-]{36}$/i.test(storeId)) throw Error('Provide a store UUID');
  const db = createAdminClient();
  const {data:jobs,error}=await db.from('product_generation_jobs').select('*').eq('store_id',storeId).eq('status','failed');
  if(error) throw error;
  for(const row of jobs??[]) {
    if(!row.state?.printQuality || row.state?.publishedVariantCount || row.state?.batches?.some((b:{artworkUrl?:string;taskKey?:string})=>b.artworkUrl||b.taskKey)) continue;
    const job=structuredClone(row) as GenerationJob;
    delete job.state.printQuality; delete job.state.artworkPlan;
    try {
      await advanceJob(db,new PrintfulClient((async()=>{throw Error('Supplier calls prohibited during hold preparation');}) as typeof fetch),job);
      throw Error('Unexpected ready state; use normal worker to continue');
    } catch(error) {
      if(!(error instanceof PrintQualityError)) throw error;
      const {data:updated,error:saveError}=await db.from('product_generation_jobs').update({state:job.state,last_error:error.message,status:'failed',updated_at:new Date().toISOString()})
        .eq('id',row.id).eq('status','failed').eq('updated_at',row.updated_at).eq('generation_id',row.generation_id).select('id').single();
      if(saveError||!updated) throw Error('Generation changed; review current state before retrying');
      console.log({title:job.template_snapshot.title,status:error.report.status,placement:job.state.artworkPlan,proofs:error.report.proofs?.length??0});
    }
  }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
