import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { advanceJob } from "../lib/lineup/worker";
import { PrintfulClient } from "../lib/lineup/printful";
import type { GenerationJob } from "../lib/lineup/types";

test("generation publishes the first color and all its sizes before remaining mockups finish", async () => {
  const sql = new PGlite();
  const assets = new Map<string, Buffer>();
  const nativeFetch = globalThis.fetch;
  try {
    await sql.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
      create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
    await sql.exec(
      readFileSync("supabase/migrations/001_initial_schema.sql", "utf8"),
    );
    await sql.exec(
      readFileSync(
        "supabase/migrations/20260914190719_product_template_lineup.sql",
        "utf8",
      ),
    );
    await sql.exec(
      readFileSync(
        "supabase/migrations/20260917172317_preview_first_logo_regeneration.sql",
        "utf8",
      ),
    );
    await sql.exec(
      readFileSync(
        "supabase/migrations/20260917192022_progressive_lineup_publication.sql",
        "utf8",
      ),
    );
    const store = "00000000-0000-0000-0000-000000000001";
    const logo = await sharp({
      create: { width: 200, height: 100, channels: 4, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    assets.set(`${store}/logo.png`, logo);
    await sql.exec(
      `update product_templates set active=true,catalog_product_id=71 where slug='t-shirt';insert into stores(id,name,slug,lineup_logo_path) values('${store}','Example','example','${store}/logo.png');`,
    );
    // Thin storage/REST adapter; SQL queue and completion logic run unchanged in Postgres.
    const db = {
      storage: {
        from: () => ({
          download: async (path: string) => ({
            data: new Blob([new Uint8Array(assets.get(path)!)]),
            error: null,
          }),
          upload: async (path: string, bytes: Buffer) => {
            assets.set(path, bytes);
            return { error: null };
          },
          getPublicUrl: (path: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/lineup-assets/${path}`,
            },
          }),
        }),
      },
      from: (table: string) => ({
        update: (values: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq: (key: string, value: unknown) => {
              filters[key] = value;
              return builder;
            },
            select: () => builder,
            single: async () => {
              const entries = Object.entries(values);
              const where = Object.entries(filters);
              const result = await sql.query(
                `update ${table} set ${entries.map(([k], i) => `${k}=$${i + 1}`).join(",")} where ${where.map(([k], i) => `${k}=$${entries.length + i + 1}`).join(" and ")} returning id`,
                [
                  ...entries.map(([, v]) =>
                    typeof v === "object" && v !== null ? JSON.stringify(v) : v,
                  ),
                  ...where.map(([, v]) => v),
                ],
              );
              return { data: result.rows[0], error: null };
            },
          };
          return builder;
        },
      }),
      rpc: async (name: string, args: Record<string, unknown>) => {
        if (name === "reserve_lineup_mockup_slot")
          return { data: 0, error: null };
        try {
          const result = await sql.query(
            `select ${name}($1,$2,$3,$4::jsonb,$5::jsonb)`,
            [
              args.p_job,
              args.p_lease,
              args.p_sync_id,
              JSON.stringify(args.p_variants),
              JSON.stringify(args.p_images),
            ],
          );
          return { data: result.rows, error: null };
        } catch (error) {
          return { error };
        }
      },
    } as unknown as Parameters<typeof advanceJob>[0];
    const client = new PrintfulClient(async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === "/products/71")
        return Response.json({
          result: {
            product: { id: 71, is_discontinued: false },
            variants: [
              {
                id: 4011,
                name: "Red / M",
                size: "M",
                color: "Red",
                in_stock: true,
              },
              {
                id: 4012,
                name: "Red / L",
                size: "L",
                color: "Red",
                in_stock: true,
              },
              {
                id: 4013,
                name: "Blue / M",
                size: "M",
                color: "Blue",
                in_stock: true,
              },
            ],
          },
        });
      if (path.includes("/printfiles/"))
        return Response.json({
          result: {
            available_placements: { front: "Front" },
            printfiles: [
              { printfile_id: 1, width: 180, height: 240, dpi: 150 },
            ],
            variant_printfiles: [
              { variant_id: 4011, placements: { front: 1 } },
              { variant_id: 4012, placements: { front: 1 } },
              { variant_id: 4013, placements: { front: 1 } },
            ],
          },
        });
      if (path.includes("/create-task/")) {
        const payload = JSON.parse(String(init?.body));
        assert.equal(payload.files[0].placement, "front");
        assert.equal(payload.files[0].position.width, 180);
        if (tasks.size === 1) {
          const listing = (
            await sql.query<{ variants: { variant_id: number }[] }>(
              "select variants from products",
            )
          ).rows[0];
          assert.deepEqual(
            listing.variants.map((v) => v.variant_id),
            [4011, 4012],
          );
          sawEarlyListing = true;
        }
        const key = String(tasks.size + 1);
        tasks.set(key, payload.variant_ids);
        return Response.json({ result: { task_key: key } });
      }
      if (path === "/mockup-generator/task")
        return Response.json({
          result: {
            status: "completed",
            mockups: [
              {
                mockup_url: "https://static.cdn.printful.com/test.jpg",
                variant_ids: tasks.get(
                  new URL(String(url)).searchParams.get("task_key")!,
                ),
              },
            ],
          },
        });
      if (path.startsWith("/store/products/@")) {
        const found = syncs.get(decodeURIComponent(path.split("@")[1]));
        return found
          ? Response.json({ result: found })
          : Response.json({ error: { message: "Not found" } }, { status: 404 });
      }
      if (path === "/store/products" && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        syncCreated++;
        syncs.set(payload.sync_product.external_id, {
          sync_product: { id: syncCreated },
          sync_variants: payload.sync_variants.map(
            (v: { variant_id: number }) => ({
              id: v.variant_id + 10000,
              variant_id: v.variant_id,
              synced: true,
            }),
          ),
        });
        return Response.json({ result: { id: syncCreated } });
      }
      throw new Error(`Unexpected Printful endpoint: ${path}`);
    });
    let syncCreated = 0;
    let sawEarlyListing = false;
    const tasks = new Map<string, number[]>();
    const syncs = new Map<string, unknown>();
    globalThis.fetch = async () =>
      new Response(new Uint8Array(logo), {
        headers: { "content-type": "image/png" },
      });
    for (let i = 0; i < 30; i++) {
      await sql.exec(`update product_generation_jobs set available_at=now()`);
      const job = (
        await sql.query<GenerationJob>("select * from claim_lineup_job()")
      ).rows[0];
      if (!job) break;
      await advanceJob(db, client, job);
    }
    const products = await sql.query<{
      published: boolean;
      variants: {
        variant_id: number;
        sync_variant_id: number;
        image_url: string;
      }[];
      thumbnail_url: string;
    }>("select * from products");
    assert.equal(products.rows.length, 1);
    assert.equal(products.rows[0].published, true);
    assert.equal(products.rows[0].variants[0].variant_id, 4011);
    assert.equal(products.rows[0].variants[0].sync_variant_id, 14011);
    assert.match(products.rows[0].thumbnail_url, /example.supabase.co/);
    assert.equal(syncCreated, 2);
    assert.equal(sawEarlyListing, true);
    assert.equal(products.rows[0].variants.length, 3);
    const mockup = [...assets.entries()].find(([key]) =>
      key.includes("mockup-"),
    )![1];
    assert.equal(
      (await sharp(mockup).metadata()).format,
      "jpeg",
      "persisted mockup bytes match their JPEG content type",
    );
    assert.equal(
      (await sql.query("select * from notifications")).rows.length,
      0,
      "initial live lineup does not send draft alerts",
    );
    const art = [...assets.entries()].find(([key]) =>
      key.includes("artwork-"),
    )![1];
    const metadata = await sharp(art).metadata();
    assert.equal(metadata.width, 180);
    assert.equal(metadata.height, 240);
    const trimmed = await sharp(art)
      .trim()
      .toBuffer({ resolveWithObject: true });
    assert.equal(trimmed.info.width, 144);
    assert.equal(trimmed.info.height, 72);
  } finally {
    globalThis.fetch = nativeFetch;
    await sql.close();
  }
});
