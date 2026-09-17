import test from "node:test";
import assert from "node:assert/strict";
import { startingCost, fastestRate, compareDelivery, type CatalogInsight } from "../lib/lineup/catalog-insights";
test("catalog cost uses only valid in-stock variant prices", () => {
  assert.equal(startingCost([{price:"4",in_stock:false},{price:"14.50",in_stock:true},{price:"12",in_stock:true},{price:"bad",in_stock:true}]),12);
  assert.equal(startingCost([{price:"0",in_stock:true}]),null);
});
test("delivery sorting prefers earliest arrival and puts unavailable quotes last", () => {
  const early={minDeliveryDate:"2026-09-22",maxDeliveryDate:"2026-09-24"};
  assert.deepEqual(fastestRate([{}, {minDeliveryDate:"2026-09-24",maxDeliveryDate:"2026-09-25"},early]),early);
  assert.equal(fastestRate([{}]),undefined);
  const insight: CatalogInsight={price:12,currency:"USD",delivery:{minDate:early.minDeliveryDate,maxDate:early.maxDeliveryDate,variant:"Black / M"}};
  assert.ok(compareDelivery(insight,undefined)<0);
  assert.ok(compareDelivery(undefined,insight)>0);
});
