import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
import {productDescription} from "../lib/lineup/product-description";
test("catalog copy becomes plain text without supplier branding or executable markup",()=>{
 assert.equal(productDescription("<p>Soft &amp; warm</p><ul><li>Cotton</li></ul><script>bad()</script>"),"Soft & warm\n• Cotton");
 assert.equal(productDescription("Made by Printful"),"Made by our production partner");
});
test("template edits reach existing products and stale jobs cannot restore old descriptions",async()=>{
 const db=new PGlite();
 try{
 await db.exec("create schema private; create table product_templates(id int primary key,description text); create table products(id int,template_id int,description text); insert into product_templates values(1,'Current');");
 await db.exec(readFileSync("supabase/migrations/20260922162710_template_descriptions.sql","utf8"));
 await db.exec("insert into products values(1,1,'Stale'); update product_templates set description='Edited' where id=1; insert into products values(2,1,'Old snapshot');");
 assert.deepEqual((await db.query("select description from products order by id")).rows,[{description:"Edited"},{description:"Edited"}]);
 await db.exec("update products set description='Owner override' where id=1");
 assert.equal((await db.query<{description:string}>("select description from products where id=1")).rows[0].description,"Edited");
 }finally{await db.close();}
});
