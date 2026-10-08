import test from "node:test";
import assert from "node:assert/strict";
import { earningsEstimate } from "../lib/product-earnings";
const variants = [{variant_id:1,retail_price:"23.00",size:"S"},{variant_id:2,retail_price:"25.00",size:"XL"}];
test("saved earnings use actual variant selling prices and 70% of margin", () => {
  assert.deepEqual(earningsEstimate(variants,{1:1402,2:1600}),{belowCost:false,priceMin:2300,priceMax:2500,profitMin:629,profitMax:630,costMin:1402,costMax:1600});
});
test("proposed all-size price recomputes the range for all selected variants", () => {
  const result=earningsEstimate(variants,{1:1402,2:1600},3000);
  assert.ok(result && !result.belowCost);
  assert.equal(result.profitMin,980);
  assert.equal(result.profitMax,1119);
});
test("missing costs are never treated as zero, and below-cost prices warn", () => {
  assert.equal(earningsEstimate(variants,{1:1402}),null);
  assert.deepEqual(earningsEstimate(variants,{1:1402,2:1600},1000),{belowCost:true});
  assert.equal(earningsEstimate(variants,{1:1402,2:1600},NaN),null);
});

import { earningsCatalogCosts } from "../lib/lineup/earnings-catalog";
test("cost lookup reads all variant pages and uses the selected technique", async () => {
  const paths: string[] = [];
  const costs = await earningsCatalogCosts({request:async <T>(path:string) => {
    paths.push(path);
    if (path === "/products/206") return {product:{files:[]}} as T;
    const offset = Number(new URL('https://example.com'+path).searchParams.get('offset'));
    return {currency:'USD',variants:Array.from({length:offset===0 ? 100 : 1},(_,i)=>({id:offset+i,techniques:[{technique_key:'embroidery',price:'18.25'},{technique_key:'dtfilm',price:'16.75'}]}))} as T;
  }},206,'dtfilm');
  assert.equal(Object.keys(costs).length,101);
  assert.equal(costs['100'],1675);
  assert.equal(paths.length,3);
});

test("earnings include the native inside label surcharge", async () => {
  const costs = await earningsCatalogCosts({request: async <T>(path: string) =>
    (path === '/products/71' ? {product:{techniques:[{key:'DTG'}],files:[{type:'label_inside',additional_price:'0.99'}]}} :
    {currency:'USD',variants:[{id:1,techniques:[{technique_key:'dtg',price:'10.00'}]}]}) as T},71,'dtg');
  assert.equal(costs['1'],1099);
});
