import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';

test('first publication outranks remediation and remaining colors, including supplier waits',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated; create role service_role;
   create table product_templates(id int primary key,active boolean default true,supplier_stock jsonb default '{}',technique text);
   create table product_generation_jobs(id int primary key,template_id int,state jsonb default '{}',template_snapshot jsonb default '{}',
    status text default 'pending',available_at timestamptz default now(),created_at timestamptz default now(),
    lease_until timestamptz,lease_token uuid,updated_at timestamptz);
   insert into product_templates(id,technique)values(1,'dtg'),(2,'embroidery');
  `);
  await db.exec(readFileSync('supabase/migrations/20260921184855_first_approved_color_priority.sql','utf8'));
  await db.exec(`
   insert into product_generation_jobs(id,template_id,state)values
   (1,1,'{"publishedVariantCount":10}'),(2,2,'{}'),(3,1,'{"printQuality":{"status":"ready"}}');
  `);
  const claim=async()=> (await db.query<{id:number}>('select id from claim_lineup_job()')).rows.map(r=>r.id);
  assert.deepEqual(await claim(),[3]);
  assert.deepEqual(await claim(),[],'global lease still prevents overlapping workers');
  await db.exec("update product_generation_jobs set status='pending',lease_until=null,available_at=now()+interval '30 seconds' where id=3");
  assert.deepEqual(await claim(),[],'do not start slow work during a short first-color wait');
  const wake=await db.query<{correct:boolean}>("select next_lineup_wakeup()=(select available_at from product_generation_jobs where id=3) correct");
  assert.equal(wake.rows[0].correct,true);
  await db.exec("update product_generation_jobs set status='failed' where id=3");
  assert.deepEqual(await claim(),[2],'quality failures do not block remediation');
  await db.exec("update product_generation_jobs set status='pending',lease_until=null,available_at=now()+interval '6 hours' where id=2");
  assert.deepEqual(await claim(),[1],'long stock/retry holds do not starve remaining colors');
  await db.exec("update product_generation_jobs set status='completed',lease_until=null; insert into product_generation_jobs(id,template_id,state)values(4,2,'{\"printQuality\":{\"status\":\"ready\"}}'),(5,1,'{\"publishedVariantCount\":1}')");
  assert.deepEqual(await claim(),[4],'already approved embroidery also gets first-publication priority');
 }finally{await db.close();}
});
