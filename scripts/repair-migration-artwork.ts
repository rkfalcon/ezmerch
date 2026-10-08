import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const dir='/tmp/verymerch-printful-migration';
type File={id:number;type:string;url:string;hash:string|null;status:string;options?:unknown[]};
type Product={sync_variants:{id:number;files:File[]}[]};
const cache:Record<string,File>=existsSync(dir+'/repaired-files.json')?JSON.parse(readFileSync(dir+'/repaired-files.json','utf8')):{};
async function request(path:string,body?:unknown,method='POST'):Promise<unknown>{
 const r=await fetch('https://api.printful.com'+path,{method:body?method:'GET',headers:{Authorization:`Bearer ${process.env.PRINTFUL_NEXT_API_TOKEN}`,'X-PF-Store-Id':process.env.PRINTFUL_NEXT_STORE_ID!,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(90000)});
 if(r.status===429){await new Promise(r=>setTimeout(r,60000));return request(path,body,method);}
 const j=await r.json();if(!r.ok)throw Error(`Artwork repair request failed ${r.status}`);return j.result;
}
export async function repairArtwork(id:number,dest:Product):Promise<Product>{
 const failed=new Map(dest.sync_variants.flatMap(v=>v.files.filter(f=>f.type!=='preview'&&!f.hash).map(f=>[f.id,f] as const)));
 if(!failed.size)return dest;
 const replacements=new Map<number,File>();
 for(const [old,f] of failed){
  let next=cache[String(old)];
  if(!next){
   next=await request('/files/'+old) as File;
   if(next.status==='failed')next=await request('/files',{url:f.url,visible:false}) as File;
   for(let tries=0;next.status==='waiting'&&tries<30;tries++){
    await new Promise(r=>setTimeout(r,2000));next=await request('/files/'+next.id) as File;
   }
   if(next.status!=='ok'||!next.hash)throw Error(`Artwork not ready after retry ${old}: ${next.status}`);
   cache[String(old)]=next;writeFileSync(dir+'/repaired-files.json',JSON.stringify(cache),{mode:0o600});
  }
  replacements.set(old,next);
 }
 // Include every existing variant ID: Printful deletes omitted variants on a product update.
 await request('/store/products/'+id,{sync_variants:dest.sync_variants.map(v=>({id:v.id,files:v.files.filter(f=>f.type!=='preview').map(f=>({id:replacements.get(f.id)?.id??f.id,type:f.type,options:f.options}))}))},'PUT');
 console.log({repairedProduct:id,files:failed.size});
 return await request('/store/products/'+id) as Product;
}
