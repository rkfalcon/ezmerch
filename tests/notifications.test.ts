import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverLineupEmails } from "../lib/lineup/notifications";

test("deferred email delivery leaves the outbox untouched without requiring credentials", async () => {
  const previous = process.env.LINEUP_EMAIL_ENABLED;
  process.env.LINEUP_EMAIL_ENABLED = "false";
  try {
    assert.deepEqual(await deliverLineupEmails(), { sent: 0 });
  } finally {
    if (previous === undefined) delete process.env.LINEUP_EMAIL_ENABLED;
    else process.env.LINEUP_EMAIL_ENABLED = previous;
  }
});
