import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createAdminClient} from '../lib/supabase/admin';
import {dashboardColors} from '../lib/product-colors';
type Variant={variant_id:number;retail_price:string;color:string;image_url?:string;artwork_pending?:boolean};
async function main(){
 const db=createAdminClient();
 const before=JSON.parse(readFileSync('/tmp/mazel-color-before.json','utf8'));
 const {data:p,error}=await db.from('products').select('*').eq('id',before.id).single();if(error)throw error;
 const variants=typeof p.variants==='string'?JSON.parse(p.variants):p.variants;
 const old=typeof before.variants==='string'?JSON.parse(before.variants):before.variants;
 assert.equal(p.published,before.published);
 assert.equal(p.default_color,before.default_color);
 assert.deepEqual(p.enabled_colors,before.enabled_colors);
 for(const v of old)assert.equal(variants.find((n:Variant)=>n.variant_id===v.variant_id)?.retail_price,v.retail_price);
 const visible=dashboardColors([...new Set<string>(variants.map((v:Variant)=>v.color))],true,p.global_active,p.global_enabled_colors);
 const {data:job}=await db.from('product_generation_jobs').select('status,last_error').eq('id','fbe5c143-213a-4235-9eae-e0b7a5a3d378').single();
 console.log({status:job?.status,error:job?.last_error,visibleColors:visible.length,expected:p.global_enabled_colors?.length,defaultColor:p.default_color,preferencesAndPricesPreserved:true});
 assert.deepEqual([...visible].sort(),[...p.global_enabled_colors!].sort());
 for(const color of visible)assert.ok(variants.some((v:Variant)=>v.color===color&&v.image_url&&!v.artwork_pending),`${color} missing ready image`);
 assert.equal(job?.status,'completed');
 console.log('PASS: all 25 enabled colors have ready images and existing owner settings are preserved.');
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
