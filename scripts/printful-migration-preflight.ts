import {createAdminClient} from '../lib/supabase/admin';
async function main(){
 const db=createAdminClient();
 for(const prefix of ['PRINTFUL','PRINTFUL_NEXT']){
 const token=process.env[`${prefix}_API_TOKEN`],store=process.env[`${prefix}_STORE_ID`];
 if(!token||!store){console.log({connection:prefix,configured:false});continue;}
 for(const path of ['/stores','/store/products?limit=1','/webhooks','/oauth/scopes','/v2/webhooks']){
 const response=await fetch(`https://api.printful.com${path}`,{headers:{Authorization:`Bearer ${token}`,'X-PF-Store-Id':store},signal:AbortSignal.timeout(20000)});
 const body=await response.json();
 console.log({connection:prefix,path,status:response.status,...(path==='/oauth/scopes'?{scopes:body.result?.scopes?.map?.((s:{scope:string})=>s.scope)}:path==='/v2/webhooks'?{events:body.data?.events?.map?.((e:{type:string})=>e.type)}:path==='/stores'?{stores:body.result?.map?.((s:{id:number;name:string;type:string})=>({id:s.id,name:s.name,type:s.type})),selectedStore:store}:path.startsWith('/store/products')?{total:body.paging?.total}: {configured:!!body.result?.url,events:body.result?.types?.map?.((t:{type:string})=>t.type)})});
 }
 }
 for(const table of ['products','orders','product_generation_jobs'] as const){
 const columns=table==='products'?'id,store_id,published,global_active,variants':table==='orders'?'id,status,printful_order_id':'id,status';
 const {data,error}=await db.from(table).select(columns);if(error)throw error;
 const counts:Record<string,number>={};for(const row of data??[]){const r=row as unknown as {status?:string;published?:boolean};const key=r.status??(r.published?'published':'draft');counts[key]=(counts[key]??0)+1;}
 console.log({table,total:data?.length,counts});
 }
}
main().catch(()=>{console.error('Preflight failed; no live configuration changed.');process.exitCode=1;});
