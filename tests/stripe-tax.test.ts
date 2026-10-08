import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import { taxCodeForProduct, calculateOrderTax } from '../lib/stripe-tax';
import { refundParameters } from '../lib/stripe-refunds';
import { calculateRevenueSplit } from '../lib/revenue';

test('merchandise categories override the platform default', () => {
 assert.equal(taxCodeForProduct('T-Shirts'), 'txcd_30011000');
 assert.equal(taxCodeForProduct('Hoodies & Sweatshirts'), 'txcd_30011000');
 assert.equal(taxCodeForProduct('Hats & Beanies'), 'txcd_30060006');
 for(const category of ['Home & Living','Bags & Accessories','Mugs & Drinkware','Other',null])
  assert.equal(taxCodeForProduct(category), 'txcd_99999999');
});
test('tax uses extended retail prices and shipping; owner receives no tax', async () => {
 const result = await calculateOrderTax({tax:{calculations:{create:async (params: Stripe.Tax.CalculationCreateParams)=>{
  assert.equal(params.line_items[0].amount,6000);
  assert.equal(params.line_items[0].quantity,2);
  assert.equal(params.line_items[0].tax_behavior,'exclusive');
  assert.equal(params.customer_details?.address?.postal_code,'07751');
  assert.equal(params.shipping_cost?.amount,500);
  assert.equal(params.shipping_cost?.tax_code,'txcd_92010001');
  return {id:'taxcalc_test',amount_total:6931,tax_amount_exclusive:431,tax_amount_inclusive:0};
 }}}} as unknown as Pick<Stripe, 'tax'>,[{reference:'item-1',priceCents:3000,quantity:2,taxCode:'txcd_99999999'}],{address1:'1 Main St',city:'Morganville',state_code:'NJ',country_code:'US',zip:'07751'},500);
 assert.equal(result.taxCents,431);
 const split=calculateRevenueSplit({claimed:true,stripe_account_id:'acct_owner'},6000,2400,500,result.taxCents);
 assert.equal(result.totalCents-split.applicationFeeCents,2520);
});
test('tax errors or inconsistent totals prevent payment creation',async()=>{
 for(const response of [{id:'x',amount_total:100,tax_amount_exclusive:5,tax_amount_inclusive:0},null])
 await assert.rejects(calculateOrderTax({tax:{calculations:{create:async()=>response}}} as unknown as Pick<Stripe, 'tax'>,[{reference:'x',priceCents:100,quantity:1,taxCode:'txcd_99999999'}],{address1:'x',city:'x',state_code:'NJ',country_code:'US',zip:'07751'},0));
});
test('destination refunds reverse owner transfers and application fees; ordinary charges omit Connect flags',()=>{
 assert.deepEqual(refundParameters({id:'pi_a',transfer_data:{destination:'acct_owner'}}),{payment_intent:'pi_a',reverse_transfer:true,refund_application_fee:true});
 assert.deepEqual(refundParameters({id:'pi_b',transfer_data:null}),{payment_intent:'pi_b'});
});
