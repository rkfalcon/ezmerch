import {readFileSync,writeFileSync} from 'node:fs';
import {PrintfulClient} from '../lib/lineup/printful';
import {quoteCheckoutCosts} from '../lib/checkout-costs';
import {effectiveTemplate} from '../lib/lineup/artwork-plan';
import type {GenerationJob} from '../lib/lineup/types';
async function main(){
 const dir='/tmp/verymerch-printful-migration',snapshot=JSON.parse(readFileSync(dir+'/snapshot.json','utf8')),mapping=JSON.parse(readFileSync(dir+'/mapping.json','utf8'));
 const client=new PrintfulClient(fetch,process.env.PRINTFUL_NEXT_STORE_ID);
 const job=(snapshot.jobs as GenerationJob[]).find(j=>j.status==='completed'&&j.state.batches?.some(b=>b.artworkUrl)&&j.template_snapshot.technique==='dtfilm');
 if(!job)throw Error('DTF fixture not ready');
 const batch=job.state.batches!.find(b=>b.artworkUrl)!;
 const id=batch.variantIds[0];
 const task=await client.createMockup(job.state.productId!,{...batch,variantIds:[id],representatives:[{id,variantIds:[id]}]},effectiveTemplate(job));
 if(!task.task_key)throw Error('New account mockup task missing');
 writeFileSync(dir+'/mockup-test.json',JSON.stringify({taskKey:task.task_key}),{mode:0o600});
 const product=snapshot.products.find((p:{published:boolean;global_active:boolean;printful_sync_product_id:number})=>p.published&&p.global_active&&mapping[p.printful_sync_product_id]);
 const m=mapping[product.printful_sync_product_id];const variant=Object.values(m.variants)[0] as number;
 const quote=await quoteCheckoutCosts({name:'VeryMerch validation',address1:'19749 Dearborn St',city:'Chatsworth',state_code:'CA',country_code:'US',zip:'91311'},[{printfulSyncVariantId:variant,quantity:1}],client);
 console.log({mockupSubmitted:true,estimate:quote,noOrderCreated:true});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
