import { test } from "node:test";
import assert from "node:assert/strict";
import {
  earningsDeadline,
  earningsEligibility,
  refundableOwnerShare,
} from "../lib/earnings/policy";
const sold = "2026-09-18T16:00:00.000Z";
test("each successful sale has exactly 30 days, independent of timezone and worker time", () => {
  assert.equal(earningsDeadline(sold), "2026-10-18T16:00:00.000Z");
  assert.equal(
    earningsEligibility(sold, null, "2026-10-18T15:59:59Z"),
    "pending",
  );
  assert.equal(
    earningsEligibility(sold, null, "2026-10-18T16:00:00Z"),
    "expired",
  );
});
test("timely qualification remains eligible even if processing happens after deadline", () => {
  assert.equal(
    earningsEligibility(sold, "2026-10-10T00:00:00Z", "2026-11-01T00:00:00Z"),
    "eligible",
  );
  assert.equal(
    earningsEligibility(sold, "2026-10-18T16:00:00Z", "2026-11-01T00:00:00Z"),
    "eligible",
  );
  assert.equal(
    earningsEligibility(sold, "2026-10-18T16:00:01Z", "2026-11-01T00:00:00Z"),
    "expired",
  );
});
test("setup on day 40 qualifies recent and future sales, not expired sales", () => {
  const setup = "2026-10-28T16:00:00Z";
  assert.equal(earningsEligibility(sold, setup, setup), "expired");
  assert.equal(
    earningsEligibility("2026-10-08T16:00:00Z", setup, setup),
    "eligible",
  );
  assert.equal(
    earningsEligibility("2026-10-29T16:00:00Z", setup, "2026-10-29T16:00:00Z"),
    "eligible",
  );
});
test("refunds reduce the share proportionally and full refunds leave zero", () => {
  assert.equal(refundableOwnerShare(1260, 3700, 0), 1260);
  assert.equal(refundableOwnerShare(1260, 3700, 1850), 630);
  assert.equal(refundableOwnerShare(1260, 3700, 3700), 0);
  assert.throws(() => refundableOwnerShare(1260, 3700, 4000));
});
