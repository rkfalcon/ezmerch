import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('ready products queue once; reminders follow delivered email and stop after launch and payouts',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table stores(id uuid primary key,owner_id uuid,claimed boolean,name text,selling_enabled boolean,stripe_account_id text);
 create table products(store_id uuid,published boolean,global_active boolean,thumbnail_url text,variants jsonb);
 create table store_payout_readiness(store_id uuid,stripe_account_id text);
 create table notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid,store_id uuid,title text,message text,href text,event_key text);
 create unique index event_unique on notifications(recipient_id,event_key) where event_key is not null;
 create table notification_emails(notification_id uuid primary key,status text default 'pending' constraint notification_emails_status_check check(status in ('pending','sent','failed')),sent_at timestamptz);
 insert into stores values('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002',true,'Dinerpedia',false,'acct_1');`);
 await db.exec(readFileSync('supabase/migrations/20260926001000_store_launch_emails.sql','utf8'));
 const count=async()=>Number((await db.query<{n:number}>('select count(*) as n from notifications')).rows[0].n);
 await db.exec('select enqueue_store_launch_emails()');assert.equal(await count(),0);
 await db.exec(`insert into products select id,true,true,'image','[{}]' from stores;select enqueue_store_launch_emails();select enqueue_store_launch_emails();`);assert.equal(await count(),1);
 await db.exec('select enqueue_store_launch_emails()');assert.equal(await count(),1);
 await db.exec(`update notification_emails set status='sent',sent_at=now()-interval '1 day';select enqueue_store_launch_emails();`);assert.equal(await count(),2);
 for (const day of [3,7,14,21,28]) {
 await db.exec(`update notification_emails set status='sent',sent_at=now()-interval '${day} days';select enqueue_store_launch_emails();select enqueue_store_launch_emails();`);
 }
 assert.equal(await count(),7);
 await db.exec(`update notification_emails set sent_at=now()-interval '60 days' where status='sent';select enqueue_store_launch_emails();`);assert.equal(await count(),7);
 await db.exec(`delete from notification_emails;delete from notifications;update stores set selling_enabled=true;insert into store_payout_readiness select id,'acct_1' from stores;select enqueue_store_launch_emails();`);assert.equal(await count(),0);
 // A Stripe account replacement must not inherit the old account's completion.
 await db.exec(`update stores set stripe_account_id='acct_2';select enqueue_store_launch_emails();`);assert.equal(await count(),1);
 }finally{await db.close();}
});
