import test from "node:test";
import assert from "node:assert/strict";
import { wakeupOptions } from "../lib/lineup/queue";
import { copyMockupChunk } from "../lib/lineup/mockup-copy";

test("queue waits until work is due, deduplicates simultaneous wakeups, and leaves long waits to recovery", () => {
 const now = 1700000000000;
 assert.equal(wakeupOptions(null,now),null);
 assert.equal(wakeupOptions("bad",now),null);
 assert.equal(wakeupOptions(new Date(now+61000).toISOString(),now),null);
 assert.equal(wakeupOptions(new Date(now+15000).toISOString(),now)?.delaySeconds,15);
 assert.deepEqual(wakeupOptions(new Date(now-1000).toISOString(),now),wakeupOptions(new Date(now).toISOString(),now));
 assert.equal(wakeupOptions(new Date(now).toISOString(),now)?.delaySeconds,3);
});
test("copy chunk preserves indexes and order, limits concurrency to three, and resumes at the saved cursor", async () => {
 let active=0, maximum=0;
 const result=await copyMockupChunk([0,1,2,3,4,5,6],2,async(item,index)=>{
  active++;maximum=Math.max(maximum,active);
  await new Promise(resolve=>setTimeout(resolve,5));active--;
  return [item,index];
 });
 assert.equal(maximum,3);assert.deepEqual(result,[[2,2],[3,3],[4,4]]);
});
test("failed copy waits for other uploads before releasing control", async () => {
 let finished=false;
 await assert.rejects(copyMockupChunk([0,1],0,async(item)=>{
  if(item===0)throw new Error("copy failed");
  await new Promise(resolve=>setTimeout(resolve,10));finished=true;
 }),/copy failed/);
 assert.equal(finished,true);
});

test("wakeup SQL ignores inactive/held jobs and respects the global lease", async () => {
 const { PGlite } = await import("@electric-sql/pglite");
 const { readFileSync } = await import("node:fs");
 const db=new PGlite();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table product_templates(id integer,active boolean,supplier_stock jsonb);
   create table product_generation_jobs(template_id integer,status text,available_at timestamptz,lease_until timestamptz);
   insert into product_templates values(1,true,null),(2,false,null);
   insert into product_generation_jobs values(1,'pending',now()+interval '15 seconds',null),(2,'pending',now(),null),(1,'failed',now(),null);`);
  await db.exec(readFileSync('supabase/migrations/20260921175458_lineup_queue_wakeup.sql','utf8'));
  const seconds=async()=>Number((await db.query<{seconds:number}>('select extract(epoch from(next_lineup_wakeup()-now())) as seconds')).rows[0].seconds);
  assert.ok(await seconds()>10);
  await db.exec("insert into product_generation_jobs values(1,'running',now(),now()+interval '3 minutes')");
  assert.ok(await seconds()>170);
  await db.exec("delete from product_generation_jobs");
  assert.equal((await db.query<{at:null}>('select next_lineup_wakeup() as at')).rows[0].at,null);
  assert.equal((await db.query<{allowed:boolean}>("select has_function_privilege('anon','next_lineup_wakeup()','execute') as allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});
