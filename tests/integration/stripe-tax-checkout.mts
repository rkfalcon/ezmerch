/** Sandbox Stripe + actual checkout/webhook handlers; database and Printful are fixtures.
 * node --env-file=.env.local --experimental-test-module-mocks --import tsx --test tests/integration/stripe-tax-checkout.mts
 */
import { test, mock } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import assert from 'node:assert/strict';
import Stripe from 'stripe';
const key=process.env.STRIPE_SECRET_KEY;
if(!key?.startsWith('sk_test_'))throw Error('Sandbox key required');
const stripe=new Stripe(key,{apiVersion:'2026-03-25.dahlia'});
process.env.STRIPE_WEBHOOK_SECRET='whsec_local_integration_fixture';
const product={id:'test-product',store_id:'test-store',template_id:'test-template',variants:[{variant_id:123,sync_variant_id:456,color:'Black',size:'M',retail_price:'30.00'}]};
let category='Home & Living';
let storedOrder: any=null;
let creations=0;
let quoteFails=false;
const db={from(table:string){
 const query:any={select(){return query},eq(){return query},in(){return query},update(value:any){if(storedOrder)Object.assign(storedOrder,value);return query},single:async()=>({data:table==='stores'?{id:'test-store',name:'Test Store',slug:'test-store',claimed:false,stripe_account_id:null,selling_enabled:true}:storedOrder,error:null}),then(resolve:any){resolve({data:table==='products'?[product]:table==='product_templates'?[{id:'test-template',category,technique:'dtg'}]:storedOrder,error:null})}};
 return query;
}};
mock.module('../../lib/supabase/server.ts',{namedExports:{createClient:async()=>db}});
mock.module('../../lib/supabase/admin.ts',{namedExports:{createAdminClient:()=>db}});
mock.module(require.resolve('@supabase/supabase-js'),{namedExports:{createClient:()=>db}});
mock.module('../../lib/stripe.ts',{namedExports:{stripe}});
mock.module('../../lib/earnings/service.ts',{namedExports:{recordOwnerEarning:async()=>{},recordPayoutReadiness:async()=>{},wakeOwnerEarning:async()=>{}}});
mock.module('../../lib/orders.ts',{namedExports:{createOrderFromPayment:async(data:any)=>{storedOrder={id:'fixture-order',...data};creations++}}});
mock.module('../../lib/lineup/printful.ts',{namedExports:{PrintfulClient:class{
 async request(path:string){
 if(path.startsWith('/products/variant/'))return {variant:{in_stock:true},product:{is_discontinued:false,techniques:[{key:'dtg',is_default:true}]}};
 if(path.includes('/availability'))return {catalog_variant_id:123,techniques:[{technique:'dtg',selling_regions:[{name:'usa',availability:'in stock'}]}]};
 if(path==='/orders/estimate-costs'){if(quoteFails)throw Error('supplier unavailable');return {costs:{currency:'USD',subtotal:'12.00',discount:'0.00',shipping:'5.00'}};}
 throw Error(`Unexpected supplier call ${path}`);
 }
}}});
const {POST:checkout}=await import('../../app/api/checkout/route');
const {POST:webhook}=await import('../../app/api/webhooks/stripe/route');
const {refundParameters}=await import('../../lib/stripe-refunds');
const cart={storeId:'test-store',items:[{productId:'test-product',variantKey:'123',quantity:1}],shippingAddress:{name:'Sandbox Buyer',address1:'1 Main Street',city:'Morganville',state_code:'NJ',country_code:'US',zip:'07751'},customerEmail:'sandbox@example.com',shippingCents:0,taxCents:0};
async function deliver(type:string,object:unknown){
 const payload=JSON.stringify({id:`evt_fixture_${type}`,object:'event',created:Math.floor(Date.now()/1000),type,livemode:false,data:{object}});
 const signature=stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET!});
 return webhook(new Request('http://localhost/api/webhooks/stripe',{method:'POST',body:payload,headers:{'stripe-signature':signature}}));
}
test('checkout → Stripe payment → signed webhook → order → refund',async()=>{
 const response=await checkout(new Request('http://localhost/api/checkout',{method:'POST',body:JSON.stringify(cart)}));
 const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));
 assert.equal(data.shippingCents,500);assert.equal(data.taxCents,232);assert.equal(data.totalCents,3732);
 const id=data.clientSecret.split('_secret_')[0];
 const paid=await stripe.paymentIntents.confirm(id,{payment_method:'pm_card_visa',return_url:'https://example.com'});
 assert.equal(paid.status,'succeeded');
 assert.equal((await deliver('payment_intent.succeeded',paid)).status,200);
 assert.equal(storedOrder.taxCents,232);assert.equal(storedOrder.totalCents,3732);
 await deliver('payment_intent.succeeded',paid);assert.equal(creations,1);
 await deliver('charge.refunded',{payment_intent:paid.id,refunded:false});
 assert.notEqual(storedOrder.status,'refunded');
 const refund=await stripe.refunds.create(refundParameters(paid));assert.equal(refund.status,'succeeded');
 const charge=await stripe.charges.retrieve(paid.latest_charge as string);
 await deliver('charge.refunded',charge);assert.equal(storedOrder.status,'refunded');
 console.log(JSON.stringify({payment:id,refund:refund.id,tax:232,duplicateOrders:creations-1}));
});
test('clothing checkout is exempt; supplier errors prevent creating a payment',async()=>{
 category='T-Shirts';
 const r=await checkout(new Request('http://localhost/api/checkout',{method:'POST',body:JSON.stringify(cart)}));
 const d=await r.json();assert.equal(r.status,200,JSON.stringify(d));assert.equal(d.taxCents,0);
 await stripe.paymentIntents.cancel(d.clientSecret.split('_secret_')[0]);
 const invalid=await checkout(new Request('http://localhost/api/checkout',{method:'POST',body:JSON.stringify({...cart,shippingAddress:{...cart.shippingAddress,zip:'invalid',state_code:'invalid'}})}));
 assert.equal(invalid.status,503);
 assert.equal((await invalid.json()).clientSecret,undefined);
 quoteFails=true;
 const failed=await checkout(new Request('http://localhost/api/checkout',{method:'POST',body:JSON.stringify(cart)}));
 assert.equal(failed.status,503);assert.equal((await failed.json()).clientSecret,undefined);
});
