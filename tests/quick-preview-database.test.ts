import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('quick preview stays independent of worker state and is cleared when artwork is replaced',async()=>{
 const pg=new PGlite();try{
 await pg.exec("create role anon;create role authenticated;create table product_generation_jobs(id int primary key,logo_path text,generation_id text,state jsonb);");
 await pg.exec(readFileSync('supabase/migrations/20260918214454_quick_lineup_previews.sql','utf8'));
 await pg.exec("insert into product_generation_jobs values(1,'old','generation1','{}','preview1');update product_generation_jobs set state='{\"working\":true}' where id=1;");
 assert.equal((await pg.query<{quick_preview_url:string}>('select quick_preview_url from product_generation_jobs')).rows[0].quick_preview_url,'preview1');
 await pg.exec("update product_generation_jobs set logo_path='new',generation_id='generation2' where id=1;update product_generation_jobs set quick_preview_url='stale' where id=1 and logo_path='old' and generation_id='generation1';");
 assert.equal((await pg.query<{quick_preview_url:string | null}>('select quick_preview_url from product_generation_jobs')).rows[0].quick_preview_url,null);
 } finally {await pg.close();}
});
