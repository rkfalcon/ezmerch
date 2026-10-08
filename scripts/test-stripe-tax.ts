/** Sandbox-only integration check. Creates test calculations, payments and full refunds.
 * Never submits Printful orders or writes to the application database.
 * Run: npx tsx --env-file=.env.local scripts/test-stripe-tax.ts
 */
import Stripe from 'stripe';
import assert from 'node:assert/strict';
import { calculateOrderTax, taxCodeForProduct } from '../lib/stripe-tax';
import { refundParameters } from '../lib/stripe-refunds';
async function main() {
const key=process.env.STRIPE_SECRET_KEY;
if(!key?.startsWith('sk_test_')) throw new Error('Sandbox secret key required. Live execution is forbidden.');
const stripe=new Stripe(key,{apiVersion:'2026-03-25.dahlia'});
const address={address1:'1 Main Street',city:'Morganville',state_code:'NJ',country_code:'US',zip:'07751'};
const settings=await stripe.tax.settings.retrieve();
if(settings.status!=='active') await stripe.tax.settings.update({head_office:{address:{line1:address.address1,city:address.city,state:'NJ',postal_code:'07751',country:'US'}},defaults:{tax_code:'txcd_99999999',tax_behavior:'exclusive'}});
const registrations=await stripe.tax.registrations.list({status:'active'});
if(!registrations.data.some(r=>r.country==='US'&&r.country_options.us?.state==='NJ'))
 await stripe.tax.registrations.create({country:'US',country_options:{us:{state:'NJ',type:'state_sales_tax'}},active_from:'now'});
for(const [label,categories,state,zip] of [
 ['clothing',['T-Shirts'],'NJ','07751'],
 ['taxable',['Home & Living'],'NJ','07751'],
 ['mixed',['T-Shirts','Home & Living'],'NJ','07751'],
 ['unregistered-state',['Home & Living'],'OR','97201'],
] as const){
 const items=categories.map((category,index)=>({reference:`test-${index}`,priceCents:3000,quantity:1,taxCode:taxCodeForProduct(category)}));
 const tax=await calculateOrderTax(stripe,items,{...address,state_code:state,zip,city:state==='NJ'?'Morganville':'Portland'},500);
 if(label==='clothing'||label==='unregistered-state')assert.equal(tax.taxCents,0);
 else assert.ok(tax.taxCents>0);
 console.log(JSON.stringify({label,...tax}));
 if(label!=='mixed')continue;
 const payment=await stripe.paymentIntents.create({amount:tax.totalCents,currency:'usd',payment_method:'pm_card_visa',payment_method_types:['card'],confirm:true,hooks:{inputs:{tax:{calculation:tax.calculationId}}},metadata:{test_purpose:'ezmerch-tax-integration'}});
 assert.equal(payment.status,'succeeded');
 const refund=await stripe.refunds.create(refundParameters(payment));
 assert.equal(refund.status,'succeeded');
 console.log(JSON.stringify({payment:payment.id,refund:refund.id,status:'payment_and_refund_succeeded'}));
 const association=await stripe.tax.associations.find({payment_intent:payment.id});
 console.log(JSON.stringify({association}));
}

}
main().catch(error => { console.error({ message: error.message, code: error.code }); process.exitCode = 1; });
