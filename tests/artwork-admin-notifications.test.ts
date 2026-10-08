import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('failed generations notify admins durably once per generation, including existing holds', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema private;
      create table stores(id uuid primary key,name text);
      create table product_generation_jobs(id uuid primary key,store_id uuid,generation_id uuid,status text,template_snapshot jsonb,last_error text);
      create table alerts(event_key text primary key,title text,href text);
      create function private.notify_admins(text,text,text,text,uuid) returns void language sql as $$
        insert into public.alerts values($4,$1,$3) on conflict do nothing $$;
      insert into stores values('00000000-0000-0000-0000-000000000001','Example');
      insert into product_generation_jobs values('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',null,'failed','{"title":"Shirt"}','Review needed');`);
    await db.exec(readFileSync('supabase/migrations/20260919223000_artwork_admin_notifications.sql','utf8'));
    assert.equal((await db.query('select * from alerts')).rows.length,1);
    await db.exec("update product_generation_jobs set status='pending'; update product_generation_jobs set status='failed';");
    assert.equal((await db.query('select * from alerts')).rows.length,1);
    await db.exec("update product_generation_jobs set generation_id='00000000-0000-0000-0000-000000000003',status='failed'");
    assert.equal((await db.query('select * from alerts')).rows.length,2);
    assert.match(String((await db.query<{href:string}>('select href from alerts limit 1')).rows[0].href),/dashboard\/admin\/stores/);
  } finally { await db.close(); }
});
