import test from "node:test";
import assert from "node:assert/strict";
import {assertMinimumPrices} from "../lib/lineup/minimum-price";
import {PGlite} from "@electric-sql/pglite";
import {readFileSync} from "node:fs";
test("template minimum rejects $19 for a $20 product and honors size prices",()=>{
 const t={retail_price_cents:2000,size_prices:{"2xl":2400}};
 assert.throws(()=>assertMinimumPrices([{size:"M",retail_price:"19.00"}],t),/20.00/);
 assert.doesNotThrow(()=>assertMinimumPrices([{size:"M",retail_price:"20.00"}],t));
 assert.throws(()=>assertMinimumPrices([{size:"2XL",retail_price:"20.00"}],t),/24.00/);
});
test("database repairs old prices and floors future writes and template price increases",async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;
 create table product_templates(id int primary key,retail_price_cents int,size_prices jsonb);
 create table products(id int primary key,template_id int,variants jsonb);
 insert into product_templates values(1,2000,'{"2xl":2400}');
 insert into products values(1,1,'[{"size":"M","retail_price":"19.00"},{"size":"2XL","retail_price":"28.00"}]');
 `);
 await db.exec(readFileSync("supabase/migrations/20260919173833_template_price_floor.sql","utf8"));
 const prices=async()=> (await db.query<{variants:{retail_price:string}[]}>("select variants from products where id=1")).rows[0].variants.map(v=>v.retail_price);
 assert.deepEqual(await prices(),["20.00","28.00"]);
 await db.exec(`update products set variants='[{"size":"M","retail_price":"19.00"},{"size":"2XL","retail_price":"19.00"}]' where id=1;`);
 assert.deepEqual(await prices(),["20.00","24.00"]);
 await db.exec("update product_templates set retail_price_cents=2200,size_prices='{\"2xl\":2600}' where id=1");
 assert.deepEqual(await prices(),["22.00","26.00"]);
 await db.exec("update product_templates set retail_price_cents=2000 where id=1");
 assert.deepEqual(await prices(),["22.00","26.00"]);
 await assert.rejects(db.exec("update products set template_id=null where id=1"),/cannot change/);
 }finally{await db.close();}
});
