import {createAdminClient} from '../lib/supabase/admin';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
const dir='/tmp/verymerch-printful-migration';mkdirSync(dir,{recursive:true,mode:0o700});
async function request(next:boolean,path:string,body?:unknown){
 const prefix=next?'PRINTFUL_NEXT':'PRINTFUL';
 const r=await fetch('https://api.printful.com'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${process.env[prefix+'_API_TOKEN']}`,'X-PF-Store-Id':process.env[prefix+'_STORE_ID']!,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 if(r.status===429){console.log("Printful rate limit; waiting before retry.");await new Promise(r=>setTimeout(r,65000));return request(next,path,body);}
 const j=await r.json();if(!r.ok)throw Error(`${next?'destination':'source'} ${path}: ${r.status} ${JSON.stringify(j.error??j.result).slice(0,300)}`);return j.result??j.data;
}
type Variant={id:number;variant_id:number;retail_price:string;currency:string;options:unknown[];files:{type:string;url:string;options:unknown[];status:string}[];synced:boolean};
type Source={sync_product:{id:number;external_id:string;name:string;thumbnail_url:string};sync_variants:Variant[]};
async function main(){
 const db=createAdminClient();
 const {data:products,error:pErr}=await db.from('products').select('*');if(pErr)throw pErr;
 const {data:jobs,error:jErr}=await db.from('product_generation_jobs').select('*');if(jErr)throw jErr;
 writeFileSync(dir+'/snapshot.json',JSON.stringify({products,jobs}),{mode:0o600});
 const ids=new Set<number>();
 for(const p of products??[])if(p.printful_sync_product_id)ids.add(p.printful_sync_product_id);
 for(const j of jobs??[]){if(j.state?.syncId)ids.add(j.state.syncId);for(const group of [j.state?.syncProducts??[],...(j.state?.batches??[]).map((b:{syncProducts?:unknown[]})=>b.syncProducts??[])])for(const s of group)if(s.sync_product?.id)ids.add(s.sync_product.id);}
 const path=dir+'/mapping.json';const mapping:Record<string,{id:number;variants:Record<string,number>}>=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{};
 console.log({referencedSyncProducts:ids.size,alreadyStaged:Object.keys(mapping).length});
 for(const id of ids){
 if(mapping[id])continue;
 const source=await request(false,`/store/products/${id}`) as Source;
 writeFileSync(dir+`/source-${id}.json`,JSON.stringify(source),{mode:0o600});
 const ext=source.sync_product.external_id || `migration-${process.env.PRINTFUL_STORE_ID}-${id}`;
 let dest:Source|undefined;
 try{dest=await request(true,`/store/products/@${encodeURIComponent(ext)}`);}catch(e){if(!(e as Error).message.includes(': 404'))throw e;}
 if(!dest){
 const payload={sync_product:{external_id:ext,name:source.sync_product.name,thumbnail_url:source.sync_product.thumbnail_url},sync_variants:source.sync_variants.map(v=>({variant_id:v.variant_id,retail_price:v.retail_price,currency:v.currency,options:v.options,files:v.files.filter(f=>f.type!=='preview').map(f=>{if(!f.url)throw Error(`Missing artwork URL for ${id}/${v.id}`);return {type:f.type,url:f.url,options:f.options};})}))};
 await request(true,'/store/products',payload);
 dest=await request(true,`/store/products/@${encodeURIComponent(ext)}`);
 }
 if(!dest||dest.sync_variants.length!==source.sync_variants.length)throw Error(`Variant count mismatch ${id}`);
 const variants:Record<string,number>={};for(const old of source.sync_variants){const matches=dest.sync_variants.filter(v=>v.variant_id===old.variant_id);if(matches.length!==1||!matches[0].synced)throw Error(`Unsynced or ambiguous variant ${id}/${old.id}`);variants[old.id]=matches[0].id;}
 mapping[id]={id:dest.sync_product.id,variants};writeFileSync(path,JSON.stringify(mapping),{mode:0o600});
 console.log({staged:Object.keys(mapping).length,total:ids.size,sourceProduct:id,destinationProduct:dest.sync_product.id});
 await new Promise(r=>setTimeout(r,1200));
 }
 console.log('Staging complete; live product records unchanged.');
}
async function run(){for(let attempt=0;attempt<12;attempt++){try{await main();return;}catch(e){const message=(e as Error).message;console.error(message);if(!/timeout|aborted|Unsynced| 5[0-9][0-9]/.test(message))throw e;console.log('Waiting before resuming from verified mappings.');await new Promise(r=>setTimeout(r,30000));}}throw Error('Staging retry limit reached');}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
