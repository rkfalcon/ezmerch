/** Supplier-only backfill. Native composites may be regenerated when reapplied. Does not modify store publication, prices or artwork approval. */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createAdminClient } from '../lib/supabase/admin';
import { printfulCredentials } from '../lib/printful-connection';
import { insideLabelPlacement, brandedFiles } from '../lib/lineup/inside-label';
import type { CatalogProduct, CatalogVariant } from '../lib/lineup/types';
import assert from 'node:assert/strict';

type File = { is_temporary?: boolean; preview_url?: string; hash?: string; status?: string; id: number; type: string; url: string; options?: {id:string;value:string|boolean}[] };
type Variant = {id:number;variant_id:number;retail_price:string;files:File[];options?:unknown[];product:{product_id:number}};
type Sync = {sync_product:{id:number};sync_variants:Variant[]};
const pause = (ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function main() {
  const apply=process.argv.includes('--apply');
  const hashes = Object.fromEntries(['black','white'].map(tone => [tone, createHash('md5').update(readFileSync(`public/branding/inside-label-v2-${tone}.png`)).digest('hex')]));
  const expectedHash = (url: string) => hashes[url.endsWith('-white.png') ? 'white' : 'black'];
  const dir=join(process.env.HOME!,'.codex/backups/verymerch-inside-labels-v2-2026-09-25');
  mkdirSync(dir,{recursive:true});
  const credentials=await printfulCredentials();
  const db=createAdminClient();
  const {data:products,error:pe}=await db.from('products').select('id,printful_sync_product_id,variants');if(pe)throw pe;
  const {data:jobs,error:je}=await db.from('product_generation_jobs').select('id,state');if(je)throw je;
  const ids=new Set<number>();
  for(const p of products??[])if(p.printful_sync_product_id)ids.add(Number(p.printful_sync_product_id));
  for(const j of jobs??[]){if(j.state?.syncId)ids.add(j.state.syncId);for(const group of [j.state?.syncProducts??[],...(j.state?.batches??[]).map((b:{syncProducts?:unknown[]})=>b.syncProducts??[])])for(const s of group)if(s.sync_product?.id)ids.add(s.sync_product.id);}
  const snapshot=join(dir,'local-before.json');if(!existsSync(snapshot))writeFileSync(snapshot,JSON.stringify({products,jobs}),{mode:0o600});
  async function request<T>(path:string,body?:unknown):Promise<T>{
    for(let attempt=0;attempt<5;attempt++){
      const r=await fetch('https://api.printful.com'+path,{method:body?'PUT':'GET',headers:{Authorization:`Bearer ${credentials.token}`,'X-PF-Store-Id':credentials.storeId!,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
      if(r.status===429){await pause(65000);continue;}
      const j=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${JSON.stringify(j).slice(0,300)}`);return j.result as T;
    }throw Error('Supplier request limit persists');
  }
  const catalogs=new Map<number,{product:CatalogProduct;variants:CatalogVariant[]}>();
  let updated=0,unsupported=0,already=0;
  for(const id of ids){
    const sync=await request<Sync>(`/store/products/${id}`);
    const catalogId=sync.sync_variants[0]?.product.product_id;if(!catalogId)throw Error('Missing catalog ID');
    let catalog=catalogs.get(catalogId);if(!catalog){catalog=await request(`/products/${catalogId}`);catalogs.set(catalogId,catalog!);}
    if(!insideLabelPlacement(catalog!.product)){unsupported++;continue;}
    const changes=sync.sync_variants.map(v=>{
      const color=catalog!.variants.find(c=>c.id===v.variant_id)?.color_code;if(!color)throw Error(`Missing color ${v.variant_id}`);
      const labeled=brandedFiles(v.files,catalog!.product,color);
      const label=labeled[labeled.length-1];
      return {id:v.id,label,files:[...v.files.filter(f=>!f.type.startsWith('label_inside') && f.type !== 'preview').map(f=>({id:f.id,type:f.type,...(f.options?{options:f.options}:{})})),label]};
    });
    if(sync.sync_variants.every((v,i)=>v.files.some(f=>f.type===changes[i].label.type&&f.hash===expectedHash(changes[i].label.url!) && f.status === 'ok'))){already++;continue;}
    console.log(JSON.stringify({id,catalog:catalog!.product.title,variants:changes.length,apply}));
    if(!apply)continue;
    const backup=join(dir,`${id}.json`);if(!existsSync(backup))writeFileSync(backup,JSON.stringify(sync),{mode:0o600});
    await request(`/store/products/${id}`,{sync_variants:changes.map(({id,files})=>({id,files}))});
    const after=await request<Sync>(`/store/products/${id}`);
    assert.deepEqual(after.sync_variants.map(v=>v.id).sort(),sync.sync_variants.map(v=>v.id).sort());
    for(const old of sync.sync_variants){const current=after.sync_variants.find(v=>v.id===old.id)!;assert.equal(current.retail_price,old.retail_price);assert.equal(current.variant_id,old.variant_id);for(const f of old.files.filter(f=>!f.type.startsWith('label_inside') && f.type !== 'preview'))assert.ok(current.files.some(n=>n.id===f.id&&n.type===f.type));const expected=changes.find(v=>v.id===old.id)!.label;assert.ok(current.files.some(f=>f.type===expected.type && (f.hash===expectedHash(expected.url!) || (f.is_temporary && f.status==='ok' && !!f.preview_url))), 'Inside label artwork did not match');}
    updated++;writeFileSync(join(dir,'progress.json'),JSON.stringify({store:credentials.storeId,updated,already,unsupported,lastId:id}),{mode:0o600});
    await pause(6500);
  }
  console.log(JSON.stringify({complete:true,updated,already,unsupported,total:ids.size}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
