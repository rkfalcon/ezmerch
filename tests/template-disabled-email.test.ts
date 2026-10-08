import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('global disable queues owner emails once per transition, excluding drafts',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema private;
 create table product_templates(id uuid primary key default gen_random_uuid(),title text,active boolean);
 create table stores(id uuid primary key default gen_random_uuid(),owner_id uuid,name text);
 create table products(store_id uuid,template_id uuid,published boolean,global_active boolean);
 create table notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid,store_id uuid,title text,message text,href text,event_key text);
 create table notification_emails(notification_id uuid);
 insert into product_templates(title,active) values('Classic Dad Hat | Yupoong',true);
 insert into stores(owner_id,name) values(gen_random_uuid(),'Live shop'),(gen_random_uuid(),'Draft shop');
 insert into products select s.id,t.id,s.name='Live shop',true from stores s cross join product_templates t;`);
 await db.exec(readFileSync('supabase/migrations/20260923200227_notify_global_product_disabled.sql','utf8'));
 await db.exec('update product_templates set active=false;update product_templates set active=false;');
 const notifications=await db.query<{message:string}>('select message from notifications');
 assert.equal(notifications.rows.length,1);
 assert.match(notifications.rows[0].message,/help@verymerch.com/);
 assert.match(notifications.rows[0].message,/Live shop/);
 assert.equal((await db.query('select * from notification_emails')).rows.length,1);
 await db.exec('update product_templates set active=true;update product_templates set active=false;');
 assert.equal((await db.query('select * from notification_emails')).rows.length,2);
 }finally{await db.close();}
});
