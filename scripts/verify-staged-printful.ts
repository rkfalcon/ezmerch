import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {repairArtwork} from './repair-migration-artwork';
import type {SyncMapping} from '../lib/lineup/migrate-sync-state';
async function main(){
 const dir='/tmp/verymerch-printful-migration',mapping:SyncMapping=JSON.parse(readFileSync(dir+'/mapping.json','utf8'));
 const done:string[]=existsSync(dir+'/verified.json')?JSON.parse(readFileSync(dir+'/verified.json','utf8')):[];
 for(const [old,m] of Object.entries(mapping)){
 if(done.includes(old))continue;
 const source=JSON.parse(readFileSync(dir+`/source-${old}.json`,'utf8'));
 const r=await fetch(`https://api.printful.com/store/products/${m.id}`,{headers:{Authorization:`Bearer ${process.env.PRINTFUL_NEXT_API_TOKEN}`,'X-PF-Store-Id':process.env.PRINTFUL_NEXT_STORE_ID!},signal:AbortSignal.timeout(30000)});
 if(r.status===429){await new Promise(r=>setTimeout(r,65000));return main();}if(!r.ok)throw Error('Destination validation failed '+r.status);
 const raw=(await r.json()).result;
 const dest=await repairArtwork(m.id,raw) as typeof raw;
 for(const v of source.sync_variants){
 const next=dest.sync_variants.find((n:{id:number})=>n.id===m.variants[v.id]);assert.ok(next?.synced,`Not synced ${old}/${v.id}`);assert.equal(next.variant_id,v.variant_id);assert.equal(next.retail_price,v.retail_price);
 for(const f of v.files.filter((f:{type:string})=>f.type!=='preview')){const file=next.files.find((n:{type:string;url:string;status:string})=>n.type===f.type&&n.url===f.url&&n.status==='ok');assert.ok(file,`Artwork mismatch ${old}/${v.id}/${f.type}`);assert.equal(file.hash,f.hash,`Artwork content mismatch ${old}/${v.id}`);assert.deepEqual(file.options,f.options,`Artwork options mismatch ${old}/${v.id}`);}
 for(const o of v.options??[])assert.ok(next.options.some((n:{id:string;value:unknown})=>n.id===o.id&&(o.id==='custom_border_color'&&typeof n.value==='string'&&typeof o.value==='string'?n.value.toLowerCase()===o.value.toLowerCase():JSON.stringify(n.value)===JSON.stringify(o.value))),`Option mismatch ${old}/${v.id}/${o.id}`);
 }
 done.push(old);writeFileSync(dir+'/verified.json',JSON.stringify(done),{mode:0o600});
 await new Promise(r=>setTimeout(r,700));
 }
 console.log({verifiedProducts:done.length,mappedProducts:Object.keys(mapping).length,artworkPricesTechniquesAndVariantsMatch:true});
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
