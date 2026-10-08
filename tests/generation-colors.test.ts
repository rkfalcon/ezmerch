import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {extendColors} from '../lib/lineup/extend-colors';
import type {GenerationJob, CatalogVariant, Printfiles} from '../lib/lineup/types';
test('new and replaced logo generations use live colors without losing placement',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema private;
 create table product_templates(id int primary key,enabled_colors text[]);
 create table product_generation_jobs(id int primary key,template_id int,template_snapshot jsonb,generation_id text,logo_path text);
 insert into product_templates values(1,array['Green','Blue']);`);
 await db.exec(readFileSync('supabase/migrations/20260924173000_refresh_generation_colors.sql','utf8'));
 await db.exec(`insert into product_generation_jobs values(1,1,'{"scale":0.8,"enabled_colors":["Black"]}','a','old');`);
 assert.deepEqual((await db.query<{template_snapshot:unknown}>('select template_snapshot from product_generation_jobs')).rows[0].template_snapshot,{scale:0.8,enabled_colors:['Green','Blue']});
 await db.exec(`update product_templates set enabled_colors=array['Red'];update product_generation_jobs set generation_id='b',logo_path='new';`);
 assert.deepEqual((await db.query<{template_snapshot:unknown}>('select template_snapshot from product_generation_jobs')).rows[0].template_snapshot,{scale:0.8,enabled_colors:['Red']});
 }finally{await db.close();}
});
const area={printfile_id:1,width:100,height:100,dpi:150};
const job={status:'completed',template_snapshot:{placement:'front'},state:{variants:[{id:1,color:'Black'}],batches:[{printfile:area,variantIds:[1],images:[{url:'existing',variant_ids:[1]}]}],printQuality:{status:'ready'},publishedVariantCount:1}} as unknown as GenerationJob;
const catalog=[{id:1,color:'Black',in_stock:true},{id:2,color:'Red',in_stock:true},{id:3,color:'Blue',in_stock:false}] as CatalogVariant[];
const files={available_placements:{front:'Front'},printfiles:[area],variant_printfiles:[{variant_id:2,placements:{front:1}}]} as Printfiles;
test('repair retains existing artwork and publication while appending allowed in-stock colors',()=>{
 const state=extendColors(job,catalog,files,['Red','Blue'])!;
 assert.equal(state.batches![0],job.state.batches![0]);
 assert.equal(state.publishedVariantCount,1);
 assert.deepEqual(state.variants!.map(v=>v.id),[1,2]);
 assert.equal(extendColors({...job,state},catalog,files,['Red']),null);
 assert.throws(()=>extendColors({...job,status:'running'},catalog,files,['Red']));
 assert.throws(()=>extendColors(job,catalog,{...files,printfiles:[{...area,width:200}]},['Red']),/assessment/);
});
