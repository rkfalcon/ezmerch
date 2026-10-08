import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {insideLabelTone,insideLabelPlacement} from '../lib/lineup/inside-label';
import {PrintfulClient,PrintfulError} from '../lib/lineup/printful';
import type {CatalogProduct,CatalogVariant} from '../lib/lineup/types';
async function main(){
 const dir=process.env.HOME+'/.codex/backups/verymerch-inside-labels-v2-2026-09-25';
 const client=new PrintfulClient();
 type Sync={sync_variants:{id:number;variant_id:number;retail_price:string;product:{product_id:number};files:{id:number;type:string;hash:string|null;status:string;is_temporary?:boolean;preview_url?:string;filename?:string}[]}[]};
 async function request<T>(path:string):Promise<T>{for(let n=0;n<4;n++)try{return await client.request<T>(path)}catch(e){if(!(e instanceof PrintfulError)||e.status!==429)throw e;await new Promise(r=>setTimeout(r,65000));}throw Error('Rate limited');}
 const catalogs=new Map<number,{product:CatalogProduct;variants:CatalogVariant[]}>();
 let products=0,variants=0;
 const normalize = (input:Buffer) => sharp(input).trim({threshold:1}).resize(600,220,{fit:'contain',background:{r:127,g:127,b:127,alpha:1}}).flatten({background:'#7f7f7f'}).removeAlpha().raw().toBuffer();
 const references = {black:await normalize(readFileSync('public/branding/inside-label-v2-black.png')),white:await normalize(readFileSync('public/branding/inside-label-v2-white.png'))};
 const compared=new Set<string>();
 let renderedLabels=0;
 const hashes = {black:createHash('md5').update(readFileSync('public/branding/inside-label-v2-black.png')).digest('hex'),white:createHash('md5').update(readFileSync('public/branding/inside-label-v2-white.png')).digest('hex')};
 for(const file of readdirSync(dir).filter(f=>/^\d+\.json$/.test(f))){
  const before:Sync=JSON.parse(readFileSync(dir+'/'+file,'utf8'));
  const after=await request<Sync>('/store/products/'+file.replace('.json',''));
  assert.deepEqual(after.sync_variants.map(v=>v.id).sort(),before.sync_variants.map(v=>v.id).sort());
  const id=before.sync_variants[0].product.product_id;
  if(!catalogs.has(id))catalogs.set(id,await request(`/products/${id}`));
  const catalog=catalogs.get(id)!;
  for(const v of before.sync_variants){
   const current=after.sync_variants.find(n=>n.id===v.id)!;
   assert.equal(current.variant_id,v.variant_id);assert.equal(current.retail_price,v.retail_price);
   for(const f of v.files.filter(f=>!f.type.startsWith('label_inside')&&f.type!=='preview'))assert.ok(current.files.some(n=>n.id===f.id&&n.type===f.type));
   const variant=catalog.variants.find(n=>n.id===v.variant_id)!;
   const label=current.files.find(f=>f.type===insideLabelPlacement(catalog.product)?.type);
   assert.ok(label);assert.equal(label.status,'ok');
   const tone=insideLabelTone(variant.color_code);
   if(label.hash)assert.equal(label.hash,hashes[tone]);
   else {
    assert.ok(label.is_temporary && label.preview_url, 'Unprocessed label file');
    const key=label.filename+':'+tone;
    if(!compared.has(key)){
     const response=await fetch(label.preview_url);assert.ok(response.ok,'Label preview unavailable');
     const pixels=await normalize(Buffer.from(await response.arrayBuffer()));
     const reference=references[tone];assert.equal(pixels.length,reference.length);
     let difference=0;for(let i=0;i<pixels.length;i++)difference+=Math.abs(pixels[i]-reference[i]);
     assert.ok(difference/pixels.length<10, `Rendered label differs: ${file} ${v.id} ${tone} ${difference/pixels.length}`);
     compared.add(key);renderedLabels++;
    }
   }
   variants++;
  }
  products++;
 }
 const report={products,variants,renderedLabels,exteriorArtworkAndPricesPreserved:true,labelsProcessedWithCorrectColor:true};
 writeFileSync(dir+'/verified.json',JSON.stringify(report),{mode:0o600});console.log(report);
}
main().catch(e=>{console.error(e);process.exitCode=1});
