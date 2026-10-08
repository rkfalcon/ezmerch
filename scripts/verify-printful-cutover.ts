import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createAdminClient} from '../lib/supabase/admin';
import {migrateSyncState,type SyncMapping} from '../lib/lineup/migrate-sync-state';
async function main(){
 const dir='/tmp/verymerch-printful-migration',db=createAdminClient();
 const before=JSON.parse(readFileSync(dir+'/cutover-before.json','utf8'));
 const mapping:SyncMapping=JSON.parse(readFileSync(dir+'/mapping.json','utf8'));
 const variants=new Map(Object.values(mapping).flatMap(m=>Object.entries(m.variants)));
 const {data:products,error:pe}=await db.from('products').select('*');if(pe)throw pe;
 const {data:jobs,error:je}=await db.from('product_generation_jobs').select('*');if(je)throw je;
 const {data:connection,error:ce}=await db.from('fulfillment_connection').select('*').single();if(ce)throw ce;
 assert.equal(connection.store_id,process.env.PRINTFUL_NEXT_STORE_ID);assert.equal(connection.paused,true);
 assert.equal(products!.length,before.products.length);assert.equal(jobs!.length,before.jobs.length);
 for(const p of before.products){
  const current: Record<string,unknown> | undefined=products!.find(n=>n.id===p.id);assert.ok(current);
  const expected: Record<string,unknown>={...p,updated_at:current.updated_at,printful_sync_product_id:p.printful_sync_product_id==null?null:mapping[p.printful_sync_product_id].id,variants:p.variants.map((v:{sync_variant_id?:number})=>v.sync_variant_id?{...v,sync_variant_id:variants.get(String(v.sync_variant_id))}:v)};
  assert.deepEqual(current,expected,`Storefront settings changed ${p.id}`);
 }
 for(const j of before.jobs){
  const current: Record<string,unknown> | undefined=jobs!.find(n=>n.id===j.id);assert.ok(current);
  const review={...(j.review_mockup??{})};delete review.taskKey;delete review.leaseUntil;
  assert.deepEqual(current,{...j,updated_at:current.updated_at,state:migrateSyncState(j.state??{},mapping),review_mockup:review,lease_until:null,lease_token:null,status:j.status==='running'?'pending':j.status},`Generation state changed ${j.id}`);
 }
 const result={products:products!.length,jobs:jobs!.length,published:products!.filter(p=>p.published).length,storefrontSettingsPricesColorsArtworkAndApprovalsPreserved:true,activeAccount:connection.store_id,paused:true};
 writeFileSync(dir+'/cutover-verified.json',JSON.stringify(result),{mode:0o600});console.log(result);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
