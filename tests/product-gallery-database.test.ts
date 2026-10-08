import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('gallery work is leased, preserves publication and rejects stale logo results',async()=>{
 const db=new PGlite();try {
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
  create table products(id uuid primary key,store_id uuid,template_id uuid,global_active boolean default true,published boolean default true);
  create table product_generation_jobs(id uuid primary key,store_id uuid,template_id uuid,generation_id uuid,status text,state jsonb,template_snapshot jsonb);
  insert into products values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003',true,true);
  insert into product_generation_jobs values('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000005','completed','{}','{"category":"T-Shirts"}');`);
  await db.exec(readFileSync('supabase/migrations/20260925180000_product_galleries.sql','utf8'));
  await db.exec(`update product_generation_jobs set template_snapshot='{"category":"Long Sleeve Shirts"}';
    insert into product_gallery_jobs(source_job,product_id,generation_id,source_revision,status,state)
    select j.id,p.id,j.generation_id,md5(j.state::text),'completed','{"unavailable":true}'
    from product_generation_jobs j join products p on p.store_id=j.store_id;`);
  await db.exec(readFileSync('supabase/migrations/20260925193000_gallery_fallbacks.sql','utf8'));
  assert.equal((await db.query<{status:string}>('select status from product_gallery_jobs')).rows[0].status,'pending');
  assert.deepEqual((await db.query<{state:unknown}>('select state from product_gallery_jobs')).rows[0].state,{});
  // Newly supported categories must be eligible without a category allowlist.
  await db.exec("update product_generation_jobs set template_snapshot='{\"category\":\"Tank Tops\"}'");
  const first=(await db.query<{id:string;lease_token:string}>('select * from claim_product_gallery_job()')).rows[0];assert.ok(first);
  assert.equal((await db.query('select * from claim_product_gallery_job()')).rows.length,0);
  await db.query('select save_product_gallery_job($1,$2,$3,$4,$5,$6)',[first.id,first.lease_token,'{}','[{"url":"new-image"}]',true,0]);
  assert.equal((await db.query<{published:boolean}>('select published from products')).rows[0].published,true);
  assert.equal((await db.query('select * from claim_product_gallery_job()')).rows.length,0);
  await db.exec("update product_generation_jobs set generation_id='00000000-0000-0000-0000-000000000006',status='pending'");
  assert.deepEqual((await db.query<{gallery_images:unknown[]}>('select gallery_images from products')).rows[0].gallery_images,[]);
  await db.exec("update product_generation_jobs set status='completed'");
  const second=(await db.query<{id:string;lease_token:string}>('select * from claim_product_gallery_job()')).rows[0];assert.ok(second);
  await db.exec("update product_generation_jobs set status='pending'");
  await db.query('select save_product_gallery_job($1,$2,$3,$4,$5,$6)',[second.id,second.lease_token,'{}','[{"url":"stale-image"}]',true,0]);
  assert.deepEqual((await db.query<{gallery_images:unknown[]}>('select gallery_images from products')).rows[0].gallery_images,[]);
 }finally{await db.close();}
});
