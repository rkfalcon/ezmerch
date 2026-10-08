import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateRevenueSplit } from '../lib/revenue';
const store = { claimed: true, stripe_account_id: 'acct_owner' };
test('owner gets 70% after production; shipping and tax stay with platform', () => {
  const split = calculateRevenueSplit(store, 3000, 1200, 500, 200);
  assert.equal(split.ownerEarningsCents, 1260);
  assert.equal(split.platformProfitCents, 540);
  assert.equal(split.platformRetainedSubtotalCents, 1740);
  assert.equal(split.applicationFeeCents, 2440);
  assert.equal(3700 - split.applicationFeeCents, 1260);
});
test('rounds owner share to cents and conserves total', () => {
  const split = calculateRevenueSplit(store, 1001, 1000, 0, 0);
  assert.equal(split.ownerEarningsCents, 1);
  assert.equal(split.applicationFeeCents + split.ownerEarningsCents, 1001);
});
test('blocks sales below production cost and invalid money', () => {
  assert.throws(() => calculateRevenueSplit(store, 1000, 1001, 0, 0));
  for (const invalid of [NaN, -1, 1.5, Infinity])
    assert.throws(() => calculateRevenueSplit(store, 3000, invalid, 0, 0));
});
test('unclaimed stores retain all funds without a destination', () => {
  const split = calculateRevenueSplit({claimed:false,stripe_account_id:null},3000,1200,500,0);
  assert.equal(split.ownerEarningsCents,0);
  assert.equal(split.destinationAccountId,null);
  assert.equal(split.platformKeepsAll,true);
});

test('new policy reserves the same 70% share before Stripe setup', () => {
  const split=calculateRevenueSplit({claimed:false,stripe_account_id:null},3000,1200,500,200,true);
  assert.equal(split.ownerEarningsCents,1260);
  assert.equal(split.platformRetainedSubtotalCents,1740);
  assert.equal(split.destinationAccountId,null);
});
