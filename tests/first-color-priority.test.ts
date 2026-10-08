import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('publish an available first mockup before background colors; retain lease exclusion',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 for(const f of ['001_initial_schema.sql','20260914190719_product_template_lineup.sql'])await db.exec(readFileSync('supabase/migrations/'+f,'utf8'));
 await db.exec(`alter table product_templates add column supplier_stock jsonb;`);
 await db.exec(readFileSync('supabase/migrations/20260921143858_first_color_publication_priority.sql','utf8'));
 await db.exec(`update product_templates set active=slug in ('t-shirt','hoodie');insert into stores(name,slug,lineup_logo_path)values('test','test','test/logo.png');
 update product_generation_jobs set state='{"publishedVariantCount":1}',available_at=now()-interval '1 hour' where template_id=(select id from product_templates where slug='hoodie');
 update product_generation_jobs set state='{"batches":[{"images":[{"url":"new","variant_ids":[1]}]}]}' where template_id=(select id from product_templates where slug='t-shirt');`);
 const first=(await db.query<{template_snapshot:{slug:string}}>('select * from claim_lineup_job()')).rows[0];
 assert.equal(first.template_snapshot.slug,'t-shirt');
 assert.equal((await db.query('select * from claim_lineup_job()')).rows.length,0);
 }finally{await db.close();}
});
