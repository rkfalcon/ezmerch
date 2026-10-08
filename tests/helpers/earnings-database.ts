import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import type { createAdminClient } from "../../lib/supabase/admin";
export async function createEarningsFixture() {
 const pg=new PGlite();
 const sid=randomUUID(), oid=randomUUID();
    await pg.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema private;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create table stores(id uuid primary key,name text,slug text,owner_id uuid,stripe_account_id text,claimed boolean);
 create table orders(id uuid primary key,store_id uuid,subtotal_cents integer,total_cents integer,platform_fee_cents integer,stripe_payment_intent_id text);
 create table user_roles(user_id uuid,role text);
 create table notifications(id uuid primary key default gen_random_uuid(),recipient_id uuid,store_id uuid,title text,message text,href text,event_key text);
 create unique index dedupe on notifications(recipient_id,event_key) where event_key is not null;
 create table notification_emails(notification_id uuid primary key);
 insert into stores values('${sid}','Example','example','${sid}',null,true);
 insert into orders values('${oid}','${sid}',3000,3700,1740,'pi_fixture');`);
    await pg.exec(
      readFileSync(
        "supabase/migrations/20260918180120_owner_earnings_deadlines.sql",
        "utf8",
      ),
    );
    const rpcArgs: Record<string, string[]> = {
      claim_owner_earning: [],
      record_payout_readiness: ["p_account", "p_at"],
      notify_owner_earning: ["p_order", "p_kind", "p_title", "p_message"],
    };
    const db = {
      rpc: async (name: string, args: Record<string, unknown> = {}) => {
        try {
          const keys = rpcArgs[name];
          const result = await pg.query(
            `select * from ${name}(${keys.map((_, i) => `$${i + 1}`).join(",")})`,
            keys.map((k) => args[k]),
          );
          return { data: JSON.parse(JSON.stringify(result.rows)), error: null };
        } catch (error) {
          return { data: null, error };
        }
      },
      from: (table: string) => {
        let update: Record<string, unknown> | null = null;
        const conditions: [string, unknown][] = [];
        const q = {
          select: () => q,
          update: (v: Record<string, unknown>) => {
            update = v;
            return q;
          },
          eq: (key: string, value: unknown) => {
            conditions.push([key, value]);
            return q;
          },
          single: async () => {
            const r = await run();
            return { ...r, data: r.data?.[0] ?? null };
          },
          maybeSingle: async () => {
            const r = await run();
            return { ...r, data: r.data?.[0] ?? null };
          },
          then: (
            resolve: (r: unknown) => unknown,
            reject: (e: unknown) => unknown,
          ) => run().then(resolve, reject),
        };
        async function run() {
          try {
            const keys = Object.keys(update ?? {}),
              values = [
                ...Object.values(update ?? {}),
                ...conditions.map((c) => c[1]),
              ];
            const where =
              conditions
                .map(([key], i) => `${key}=$${keys.length + i + 1}`)
                .join(" and ") || "true";
            const sql = update
              ? `update ${table} set ${keys.map((k, i) => `${k}=$${i + 1}`).join(",")} where ${where} returning *`
              : `select * from ${table} where ${where}`;
            const result = await pg.query(sql, values);
            return {
              data: JSON.parse(JSON.stringify(result.rows)),
              error: null,
            };
          } catch (error) {
            return { data: null, error };
          }
        }
        return q;
      },
    } as unknown as ReturnType<typeof createAdminClient>;

 return {pg,db,sid,oid};
}
