import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverQueuedEmail } from "../lib/email/delivery";
import type { createAdminClient } from "../lib/supabase/admin";

for (const queue of ["invitation", "website"] as const)
  test(`${queue}: delivery retries an immutable message with the same idempotency key, then records provider acceptance`, async () => {
    const key = process.env.RESEND_API_KEY,
      from = process.env.NOTIFICATION_FROM_EMAIL;
    process.env.RESEND_API_KEY = "test-only";
    process.env.NOTIFICATION_FROM_EMAIL = "test@example.com";
    let attempts = 0;
    const updates: Record<string, unknown>[] = [];
    const payload = {
      from: "test@example.com",
      to: ["owner@example.com"],
      subject: "Invite",
      html: "<p>Claim</p>",
      text: "Claim",
    };
    const db = {
      rpc: async () => ({
        data: [{ id: "inv-1", attempts: ++attempts, email_payload: payload }],
        error: null,
      }),
      from: () => ({
        update: (value: Record<string, unknown>) => {
          updates.push(value);
          const q = {
            eq: () => q,
            then: (resolve: (v: unknown) => unknown) =>
              Promise.resolve({ error: null }).then(resolve),
          };
          return q;
        },
      }),
    } as unknown as ReturnType<typeof createAdminClient>;
    const keys: string[] = [],
      bodies: string[] = [];
    const send = (async (_url: unknown, init: RequestInit) => {
      keys.push((init.headers as Record<string, string>)["Idempotency-Key"]);
      bodies.push(String(init.body));
      return keys.length === 1
        ? new Response("busy", { status: 429 })
        : Response.json({ id: "resend-123" });
    }) as typeof fetch;
    try {
      assert.deepEqual(await deliverQueuedEmail(queue, "inv-1", db, send), {
        sent: false,
      });
      assert.equal(updates[0].email_status, "pending");
      assert.deepEqual(await deliverQueuedEmail(queue, "inv-1", db, send), {
        sent: true,
      });
      assert.equal(updates[1].resend_id, "resend-123");
      assert.equal(updates[1].email_status, "sent");
      assert.deepEqual(
        keys,
        Array(2).fill(
          queue === "invitation" ? "store-invite-inv-1" : "store-website-inv-1",
        ),
      );
      assert.equal(bodies[0], bodies[1]);
    } finally {
      if (key === undefined) delete process.env.RESEND_API_KEY;
      else process.env.RESEND_API_KEY = key;
      if (from === undefined) delete process.env.NOTIFICATION_FROM_EMAIL;
      else process.env.NOTIFICATION_FROM_EMAIL = from;
    }
  });
