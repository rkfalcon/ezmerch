import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
test('lineup completion notifies owner and admin once, only after all active jobs finish',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema private;
 create table stores(id uuid primary key,owner_id uuid,name text,lineup_logo_path text,selling_enabled boolean);
 create table product_templates(id uuid primary key,active boolean);
 create table product_generation_jobs(id uuid primary key,store_id uuid,template_id uuid,generation_id uuid,logo_path text,status text);
 create table products(id uuid primary key,store_id uuid,template_id uuid,published boolean,global_active boolean);
 create table user_roles(user_id uuid,role text);
 create table notifications(id uuid default gen_random_uuid() primary key,recipient_id uuid,store_id uuid,title text,message text,href text,event_key text);
 create unique index notification_event_recipient on notifications(recipient_id,event_key) where event_key is not null;
 create table notification_emails(notification_id uuid primary key);
 insert into stores values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Sunday','logo/new',true);
 insert into user_roles values('00000000-0000-0000-0000-000000000003','admin');
 insert into product_templates select ('00000000-0000-0000-0000-00000000000'||i)::uuid,true from generate_series(4,5)i;
 insert into product_generation_jobs select id,'00000000-0000-0000-0000-000000000001',id,gen_random_uuid(),'logo/new','pending' from product_templates;
 insert into products select id,'00000000-0000-0000-0000-000000000001',id,true,true from product_templates;`);
 await db.exec(readFileSync('supabase/migrations/20260921144309_lineup_completion_and_preview_plan.sql','utf8'));
 await db.exec(`update product_generation_jobs set status='completed' where id='00000000-0000-0000-0000-000000000004';`);
 assert.equal((await db.query('select * from notifications')).rows.length,0);
 await db.exec(`update product_generation_jobs set status='failed' where id='00000000-0000-0000-0000-000000000005';`);
 assert.equal((await db.query('select * from notifications')).rows.length,0);
 await db.exec(`update product_generation_jobs set status='completed';update product_generation_jobs set status='completed';`);
 const messages=(await db.query<{message:string}>('select * from notifications')).rows;
 assert.equal(messages.length,2);assert.match(messages[0].message,/ready for customers to purchase/);
 assert.equal((await db.query('select * from notification_emails')).rows.length,2);
 await db.exec(`update stores set selling_enabled=false;update product_generation_jobs set generation_id=gen_random_uuid(),status='pending';update product_generation_jobs set status='completed';`);
 const next=(await db.query<{message:string}>('select * from notifications')).rows;
 assert.equal(next.length,4);assert.ok(next.some(n=>n.message.includes('store-launch')));
 }finally{await db.close();}
});
