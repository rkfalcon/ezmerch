import test from "node:test";
import assert from "node:assert/strict";
import { sizesForPricing, applySizePrice } from "../lib/lineup/size-prices";
test("size prices update every color of that size and preserve other sizes",()=>{
 const variants=[{variant_id:1,size:"XL",color:"Black",retail_price:"20"},{variant_id:2,size:"M",color:"Red",retail_price:"20"},{variant_id:3,size:"XL",color:"White",retail_price:"21"}];
 assert.deepEqual(sizesForPricing(variants),["M","XL"]);
 assert.deepEqual(applySizePrice(variants,2400,"XL").map(v=>v.retail_price),["24.00","20","24.00"]);
 assert.equal(applySizePrice(variants,2500).every(v=>v.retail_price==="25.00"),true);
 assert.throws(()=>applySizePrice(variants,2400,"XS"));
 assert.deepEqual(sizesForPricing([{}, {size:""}]),["One size"]);
});
