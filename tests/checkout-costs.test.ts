import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteCheckoutCosts, dollarsToCents } from '../lib/checkout-costs';
import { PrintfulClient } from '../lib/lineup/printful';
test('quotes exact synchronized artwork and quantities without creating an order', async () => {
 const client = new PrintfulClient(async (url, init) => {
   assert.equal(url,'https://api.printful.com/orders/estimate-costs');
   assert.deepEqual(JSON.parse(String(init?.body)), {shipping:'STANDARD',recipient:{zip:'07751'},items:[{sync_variant_id:123,quantity:2}]});
   return Response.json({result:{costs:{currency:'USD',subtotal:'24.00',discount:'2.00',digitization:'3.00',shipping:'5.50'}}});
 });
 assert.deepEqual(await quoteCheckoutCosts({zip:'07751'},[{printfulSyncVariantId:123,quantity:2}],client),{productionCostCents:2500,shippingCents:550});
});
test('missing or malformed quotes fail closed', async () => {
 for (const costs of [null, {currency:'EUR'}, {currency:'USD',subtotal:'unknown',discount:'0',shipping:'5'}]) {
 const client=new PrintfulClient(async()=>Response.json({result:{costs}}));
 await assert.rejects(quoteCheckoutCosts({},[],client));
 }
 for(const amount of [null, undefined, '', 'NaN', '-1', '1.234', -1, 1.234, NaN, Infinity, true, {}, Number.MAX_SAFE_INTEGER]) assert.throws(()=>dollarsToCents(amount));
 assert.equal(dollarsToCents('12.34'),1234);
});
test('accepts numeric amounts returned by live fulfillment estimates', async () => {
 const client = new PrintfulClient(async () => Response.json({result:{costs:{
   currency:'USD',subtotal:24.63,discount:0,shipping:8.79,
   digitization:0,additional_fee:0,fulfillment_fee:0,
 }}}));
 assert.deepEqual(await quoteCheckoutCosts({},[{printfulSyncVariantId:123,quantity:1}],client),
   {productionCostCents:2463,shippingCents:879});
 assert.equal(dollarsToCents(1),100);
 assert.equal(dollarsToCents(0),0);
});
