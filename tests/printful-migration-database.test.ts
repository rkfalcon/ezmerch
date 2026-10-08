import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('account switch is paused, atomic, and refuses changed inventory',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create table orders(id int);
 create table products(id uuid primary key default gen_random_uuid(),updated_at timestamptz default now(),variants jsonb default '[]',printful_sync_product_id bigint);
 create table product_generation_jobs(id uuid primary key default gen_random_uuid(),updated_at timestamptz default now(),state jsonb default '{}',review_mockup jsonb,lease_until timestamptz,lease_token uuid,status text default 'completed');
 insert into products(printful_sync_product_id) values(10);insert into product_generation_jobs default values;`);
 await db.exec(readFileSync('supabase/migrations/20260924210000_printful_connection.sql','utf8'));
 const products=(await db.query<{id:string;updated_at:string}>('select id,updated_at::text from products')).rows.map(p=>({...p,sync_id:100,variants:[]}));
 const jobs=(await db.query<{id:string;updated_at:string}>('select id,updated_at::text from product_generation_jobs')).rows.map(j=>({...j,state:{syncId:100},review_mockup:null}));
 const call=()=>db.query('select switch_printful_connection($1,$2,$3::jsonb,$4::jsonb)',['17933770','18805803',JSON.stringify(products),JSON.stringify(jobs)]);
 await assert.rejects(call(),/Pause/);
 await db.exec('update fulfillment_connection set paused=true');
 jobs[0].updated_at='2000-01-01';await assert.rejects(call(),/Job changed/);
 assert.equal((await db.query<{id:number}>('select printful_sync_product_id id from products')).rows[0].id,10);
 jobs[0].updated_at=(await db.query<{time:string}>('select updated_at::text time from product_generation_jobs')).rows[0].time;
 await call();
 assert.equal((await db.query<{id:number}>('select printful_sync_product_id id from products')).rows[0].id,100);
 assert.deepEqual((await db.query('select store_id,paused from fulfillment_connection')).rows,[{store_id:'18805803',paused:true}]);
 }finally{await db.close();}
});
