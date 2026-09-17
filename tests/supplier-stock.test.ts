import { test } from "node:test";
import assert from "node:assert/strict";
import { availableInUSA, readStock } from "../lib/lineup/availability";
import { PrintfulClient } from "../lib/lineup/printful";
import { inStock } from "../lib/supplier-stock";
import { enabledVariants } from "../lib/product-colors";
test("availability respects technique and region", () => {
  const row = {
    catalog_variant_id: 1,
    techniques: [
      {
        technique: "dtg",
        selling_regions: [
          { name: "usa", availability: "out of stock" },
          { name: "europe", availability: "in stock" },
        ],
      },
      {
        technique: "embroidery",
        selling_regions: [{ name: "usa", availability: "in stock" }],
      },
    ],
  };
  assert.equal(availableInUSA(row, "dtg"), false);
  assert.equal(availableInUSA(row, "embroidery"), true);
});
test("restocking never overrides manual color settings; removed variants stay unavailable", () => {
  const variants = [
    { variant_id: 1, color: "Black" },
    { variant_id: 2, color: "White" },
    { variant_id: 3, color: "Red" },
  ];
  const stock = {
    discontinued: false,
    unavailable: [],
    available: [1, 2],
    checkedAt: "now",
  };
  assert.deepEqual(
    inStock(enabledVariants(variants, ["Black", "Red"]), stock),
    [variants[0]],
  );
  assert.deepEqual(inStock(variants, { ...stock, discontinued: true }), []);
});
test("provider errors do not masquerade as discontinued products", async () => {
  const client = new PrintfulClient(
    async () =>
      new Response(JSON.stringify({ error: { message: "Unavailable" } }), {
        status: 503,
      }),
  );
  await assert.rejects(() => readStock(71, "print", client), /503/);
});
test("out of stock catalog is distinguished from discontinued without relying on missing v2 endpoint", async () => {
  const client = new PrintfulClient(async () =>
    Response.json({
      result: {
        product: { is_discontinued: false },
        variants: [{ id: 2, in_stock: false }],
      },
    }),
  );
  const stock = await readStock(788, "print", client);
  assert.equal(stock.discontinued, false);
  assert.deepEqual(stock.available, []);
  assert.deepEqual(stock.unavailable, [2]);
});

test("stock updates propagate transactionally, deduplicate alerts, preserve owner choices, and cover future products", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { readFileSync } = await import("node:fs");
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;create schema private;
 create table product_templates(id uuid primary key,title text);create table products(id uuid default gen_random_uuid(),template_id uuid,store_id uuid,published boolean,enabled_colors text[]);
 create table stores(id uuid primary key,owner_id uuid);create table user_roles(user_id uuid,role text);
 create table notifications(id uuid default gen_random_uuid() primary key,recipient_id uuid,store_id uuid not null,product_id uuid not null,title text,message text,href text,unique(recipient_id,product_id));
 create table notification_emails(notification_id uuid);create table orders(id uuid,store_id uuid,status text);`);
    await db.exec(
      readFileSync(
        "supabase/migrations/20260917183224_sync_printful_availability.sql",
        "utf8",
      ).split("create or replace function public.claim_lineup_job")[0],
    );
    const id = "00000000-0000-0000-0000-000000000001",
      owner = "00000000-0000-0000-0000-000000000002";
    await db.exec(
      `insert into product_templates values('${id}','Shirt',null,null,now());insert into stores values('${id}','${owner}');insert into user_roles values('${id}','admin');insert into products(template_id,store_id,published,enabled_colors) values('${id}','${id}',false,array['Black']);`,
    );
    const first = {
      discontinued: false,
      available: [1],
      unavailable: [2],
      checkedAt: "2026-09-17T10:00:00Z",
    };
    await db.query("select apply_supplier_stock($1,$2)", [
      id,
      JSON.stringify(first),
    ]);
    await db.query("select apply_supplier_stock($1,$2)", [
      id,
      JSON.stringify({ ...first, checkedAt: "2026-09-17T10:01:00Z" }),
    ]);
    assert.equal(
      (await db.query("select * from notifications")).rows.length,
      2,
    );
    const restored = {
      ...first,
      available: [1, 2],
      unavailable: [],
      checkedAt: "2026-09-17T11:00:00Z",
    };
    await db.query("select apply_supplier_stock($1,$2)", [
      id,
      JSON.stringify(restored),
    ]);
    assert.equal(
      (await db.query("select * from notification_emails")).rows.length,
      4,
    );
    const product = (
      await db.query<{
        published: boolean;
        enabled_colors: string[];
        supplier_stock: unknown;
      }>("select * from products")
    ).rows[0];
    assert.equal(product.published, false);
    assert.deepEqual(product.enabled_colors, ["Black"]);
    assert.deepEqual(product.supplier_stock, restored);
    await db.query("select apply_supplier_stock($1,$2)", [
      id,
      JSON.stringify(first),
    ]);
    assert.deepEqual(
      (
        await db.query<{ supplier_stock: unknown }>(
          "select supplier_stock from products",
        )
      ).rows[0].supplier_stock,
      restored,
    );
    assert.equal(
      (
        await db.query<{ allowed: boolean }>(
          "select has_function_privilege('authenticated','apply_supplier_stock(uuid,jsonb)','execute') allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});
