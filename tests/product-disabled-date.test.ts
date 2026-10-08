import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('disabled dates propagate, survive edits, clear on reactivation, and leave historical dates unknown',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema private;
 create table product_templates(id uuid primary key default gen_random_uuid(),active boolean);
 create table products(template_id uuid,published boolean);
 alter table products enable row level security;
 create policy "Anyone can view published products" on products for select using(published);
 insert into product_templates(active) values(false),(true);
 insert into products select id,true from product_templates;`);
 await db.exec(readFileSync('supabase/migrations/20260916204818_global_product_availability.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20260923200950_product_disabled_dates.sql','utf8'));
 assert.equal((await db.query<{disabled_at:Date|null}>('select disabled_at from product_templates where not active')).rows[0].disabled_at,null);
 const id=(await db.query<{id:string}>('select id from product_templates where active')).rows[0].id;
 await db.query('update product_templates set active=false where id=$1',[id]);
 const date=(await db.query<{disabled_at:string}>('select disabled_at from product_templates where id=$1',[id])).rows[0].disabled_at;
 assert.ok(date);
 assert.deepEqual((await db.query<{global_disabled_at:Date|null}>('select global_disabled_at from products where template_id=$1',[id])).rows[0].global_disabled_at,date);
 await db.query('update product_templates set active=false where id=$1',[id]);
 assert.deepEqual((await db.query<{disabled_at:Date|null}>('select disabled_at from product_templates where id=$1',[id])).rows[0].disabled_at,date);
 await db.query('update product_templates set active=true where id=$1',[id]);
 assert.deepEqual((await db.query<{global_disabled_at:Date|null}>('select global_disabled_at from products where template_id=$1',[id])).rows[0].global_disabled_at,null);
 }finally{await db.close();}
});
