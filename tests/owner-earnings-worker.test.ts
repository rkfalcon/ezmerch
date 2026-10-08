import { test } from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { createEarningsFixture } from "./helpers/earnings-database";

// Execute the actual worker against PostgreSQL; only Stripe's external boundary
// is simulated so no real money is transferred during the test suite.
test("earnings worker: pending sale email, deadline expiry, late verification, transfer recovery and refunds", async () => {
  process.env.STRIPE_SECRET_KEY ||= "sk_test_fixture";
  const { processOwnerEarnings } = await import("../lib/earnings/worker");
  const {pg,db,sid,oid} = await createEarningsFixture();
  try {
    let ready = false,
      refunded = 0,
      transfers = 0,
      failAfterTransfer = false,
      apiFails = false;
    let savedTransfer: {
      id: string;
      amount: number;
      amount_reversed: number;
    } | null = null;
    const stripe = {
      paymentIntents: {
        update: async () => ({}),
        retrieve: async () => {
          if (apiFails) throw Error("Stripe unavailable");
          return {
            status: "succeeded",
            metadata: { revenue_split_version: "owner-margin-70-30-30days-v1" },
            latest_charge: {
              id: "ch_fixture",
              amount: 3700,
              amount_refunded: refunded,
              refunded: refunded === 3700,
              disputed: false,
            },
          };
        },
      },
      accounts: {
        retrieve: async () => ({
          id: "acct_fixture",
          charges_enabled: ready,
          payouts_enabled: ready,
          capabilities: { transfers: ready ? "active" : "inactive" },
        }),
      },
      transfers: {
        list: async () => ({ data: savedTransfer ? [savedTransfer] : [] }),
        retrieve: async () => savedTransfer,
        create: async (params: { amount: number }) => {
          transfers++;
          savedTransfer = {
            id: "tr_fixture",
            amount: params.amount,
            amount_reversed: 0,
          };
          if (failAfterTransfer) {
            failAfterTransfer = false;
            throw Error("Connection lost after transfer");
          }
          return savedTransfer;
        },
        createReversal: async (_: string, params: { amount: number }) => {
          savedTransfer!.amount_reversed += params.amount;
          return {};
        },
      },
    } as unknown as Stripe;
    const run = () => processOwnerEarnings(1, db, stripe);
    const wake = () =>
      pg.exec(
        `update owner_earnings set next_check_at=now(),locked_until='-infinity'`,
      );
    const row = async () =>
      (
        await pg.query<{
          status: string;
          owner_cents: number;
          stripe_transfer_id: string | null;
          last_error: string | null;
        }>("select * from owner_earnings")
      ).rows[0];
    await pg.exec(`select record_owner_earning('${oid}',now(),1200)`);
    await run();
    assert.equal((await row()).status, "pending");
    assert.equal(
      (await pg.query("select * from notification_emails")).rows.length,
      1,
    );
    await wake();
    await run();
    assert.equal(
      (await pg.query("select * from notification_emails")).rows.length,
      1,
      "sale retry does not duplicate email",
    );
    await pg.exec(
      `update owner_earnings set sold_at=now()-interval '31 days',deadline_at=now()-interval '1 day',next_check_at=now()`,
    );
    apiFails = true;
    await run();
    assert.equal(
      (await row()).status,
      "pending",
      "outage does not forfeit earnings",
    );
    apiFails = false;
    await wake();
    await run();
    assert.equal((await row()).status, "expired");
    assert.equal((await row()).owner_cents, 0);
    // Delayed signed webhook proving qualification before deadline restores eligibility.
    await pg.exec(
      `update stores set stripe_account_id='acct_fixture'; select record_payout_readiness('acct_fixture',now()-interval '2 days')`,
    );
    ready = true;
    failAfterTransfer = true;
    await run();
    assert.equal(transfers, 1);
    assert.ok((await row()).last_error);
    await wake();
    await run();
    assert.equal(transfers, 1, "lost response recovered using transfer group");
    assert.equal((await row()).status, "transferred");
    assert.equal((await row()).owner_cents, 1260);
    refunded = 1850;
    await wake();
    await run();
    assert.equal(savedTransfer!.amount_reversed, 630);
    assert.equal((await row()).owner_cents, 630);
    await wake();
    await run();
    assert.equal(
      savedTransfer!.amount_reversed,
      630,
      "duplicate refund causes no duplicate reversal",
    );
    refunded = 3700;
    await wake();
    await run();
    assert.equal(savedTransfer!.amount_reversed, 1260);
    assert.equal((await row()).status, "refunded");
  } finally {
    await pg.close();
  }
});
