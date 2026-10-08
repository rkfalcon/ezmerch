import {createAdminClient} from '../lib/supabase/admin';
import {readFileSync,writeFileSync} from 'node:fs';
import {migrateSyncState,type SyncMapping} from '../lib/lineup/migrate-sync-state';
async function main(){
 const db=createAdminClient(),dir='/tmp/verymerch-printful-migration';
 const mapping:SyncMapping=JSON.parse(readFileSync(dir+'/mapping.json','utf8'));
 const variants=new Map(Object.values(mapping).flatMap(m=>Object.entries(m.variants)));
 const {data:products,error:pe}=await db.from('products').select('*');if(pe)throw pe;
 const {data:jobs,error:je}=await db.from('product_generation_jobs').select('*');if(je)throw je;
 const pProducts=products!.map(p=>({id:p.id,updated_at:p.updated_at,sync_id:p.printful_sync_product_id==null?null:mapping[p.printful_sync_product_id]?.id,variants:p.variants.map((v:{sync_variant_id?:number})=>{if(!v.sync_variant_id)return v;const id=variants.get(String(v.sync_variant_id));if(!id)throw Error(`Missing product variant ${v.sync_variant_id}`);return {...v,sync_variant_id:id};})}));
 if(pProducts.some(p=>p.sync_id===undefined))throw Error('Missing product mapping');
 const pJobs=jobs!.map(j=>{const review={...(j.review_mockup??{})};delete review.taskKey;delete review.leaseUntil;return {id:j.id,updated_at:j.updated_at,state:migrateSyncState(j.state??{},mapping),review_mockup:review};});
 writeFileSync(dir+'/cutover-before.json',JSON.stringify({products,jobs}),{mode:0o600});
 console.log({products:pProducts.length,jobs:pJobs.length,mappedVariants:variants.size,apply:process.argv.includes('--apply')});
 if(process.argv.includes('--apply')){
  const {error}=await db.rpc('switch_printful_connection',{p_old:process.env.PRINTFUL_STORE_ID,p_new:process.env.PRINTFUL_NEXT_STORE_ID,p_products:pProducts,p_jobs:pJobs});if(error)throw error;
  console.log('Mappings and account switched atomically; checkout remains paused until verified.');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
