import test from 'node:test';
import assert from 'node:assert/strict';
import {templateColors,assertColorLimit} from '../lib/lineup/color-limit';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

test('cap defaults to 25 unique colors, preserves saved choices, retains all sizes',()=>{
 const variants=Array.from({length:84},(_,i)=>({color:`Color ${i}`}));
 const selection=templateColors(variants);
 assert.equal(selection.length,25);
 assert.deepEqual(templateColors(variants,['Color 83','Color 80']),['Color 83','Color 80']);
 assert.deepEqual(templateColors([{color:'Black'},{color:'Black'},{color:'Red'}]),['Black','Red']);
 assert.throws(()=>assertColorLimit(variants.map(v=>v.color)),/no more than 25/);
 assert.doesNotThrow(()=>assertColorLimit(selection));
});
test('database rejects more than 25 colors and unlimited resolved templates',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create table product_templates(id uuid,catalog_product_id integer,enabled_colors text[]);');
  await db.exec(readFileSync('supabase/migrations/20260921181214_template_color_cap.sql','utf8'));
  await assert.rejects(db.exec("insert into product_templates(catalog_product_id,enabled_colors) values(1,array(select 'Color '||i from generate_series(1,26)i))"),/template_max_25_colors/);
  await assert.rejects(db.exec("insert into product_templates(catalog_product_id)values(1)"),/template_max_25_colors/);
  await db.exec("insert into product_templates(catalog_product_id,enabled_colors) values(1,array(select 'Color '||i from generate_series(1,25)i))");
 }finally{await db.close();}
});

test('worker plans only selected colors and keeps every size of each selected color',async()=>{
 const {advanceJob}=await import('../lib/lineup/worker');
 const variants=[{id:1,color:'Black',size:'S',in_stock:true},{id:2,color:'Black',size:'L',in_stock:true},{id:3,color:'Red',size:'M',in_stock:true}];
 let saved:Record<string,unknown>|undefined;
 const db={rpc:async(_name:string,args:Record<string,unknown>)=>{saved=args;return {data:'job',error:null};}};
 const client={resolve:async()=>1,product:async()=>({product:{},variants}),printfiles:async()=>({available_placements:{front:'Front'},printfiles:[{printfile_id:1,width:100,height:100,dpi:150}],variant_printfiles:variants.map(v=>({variant_id:v.id,placements:{front:1}}))})};
 const job={id:'job',store_id:'store',lease_token:'lease',state:{},template_snapshot:{enabled_colors:['Black'],retail_price_cents:2000,size_prices:{},placement:'front',technique:'dtg',option_groups:[]}};
 await advanceJob(db as unknown as Parameters<typeof advanceJob>[0],client as unknown as Parameters<typeof advanceJob>[1],job as unknown as Parameters<typeof advanceJob>[2]);
 const patch=saved!.p_patch as {variants:{id:number}[]};
 assert.deepEqual(patch.variants.map(v=>v.id),[1,2]);
});

test('exhausted mockup quota waits a full quiet minute even when provider reset is shorter',async()=>{
 const {mockupQuotaCooldown}=await import('../lib/lineup/printful');
 assert.equal(mockupQuotaCooldown(new Headers({'x-ratelimit-remaining':'0','x-ratelimit-reset':'26'})),65000);
 assert.equal(mockupQuotaCooldown(new Headers({'x-ratelimit-remaining':'1','x-ratelimit-reset':'60'})),0);
 assert.equal(mockupQuotaCooldown(new Headers()),0);
 assert.equal(mockupQuotaCooldown(new Headers({'x-ratelimit-remaining':'0','x-ratelimit-reset':'bad'})),65000);
});
