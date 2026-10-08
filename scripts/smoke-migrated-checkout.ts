import {createAdminClient} from '../lib/supabase/admin';
import Stripe from 'stripe';
import {enabledVariants,type ColorVariant} from '../lib/product-colors';
import assert from 'node:assert/strict';
async function main(){
 const db=createAdminClient();
 const {data:store,error:se}=await db.from('stores').select('id').eq('slug','mazellist').single();if(se)throw se;
 const {data:products,error:pe}=await db.from('products').select('*').eq('store_id',store.id).eq('published',true).eq('global_active',true);if(pe)throw pe;
 const product=products!.find(p=>p.title.includes('Staple'));if(!product)throw Error('Checkout fixture unavailable');
 const variant=enabledVariants<ColorVariant>(product.variants,product.enabled_colors,product.global_enabled_colors).find(v=>!v.artwork_pending&&v.sync_variant_id&&(!product.supplier_stock?.available||product.supplier_stock.available.includes(v.variant_id))&&!product.supplier_stock?.unavailable?.includes(v.variant_id));if(!variant)throw Error('No purchasable fixture');
 const r=await fetch('https://www.verymerch.com/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({storeId:store.id,items:[{productId:product.id,variantKey:String(variant.variant_id),quantity:1}],shippingAddress:{name:'VeryMerch migration test',address1:'19749 Dearborn St',city:'Chatsworth',state_code:'CA',country_code:'US',zip:'91311'},customerEmail:'help@verymerch.com'})});
 const result=await r.json();if(!r.ok)throw Error(`Checkout ${r.status}: ${result.error}`);
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY!);const id=String(result.clientSecret).split('_secret_')[0];
 try{
 const intent=await stripe.paymentIntents.retrieve(id);
 assert.equal(intent.status,'requires_payment_method');assert.equal(intent.metadata.printful_store_id,process.env.PRINTFUL_NEXT_STORE_ID);
 const items=JSON.parse(intent.metadata.items);assert.equal(items[0].printfulSyncVariantId,variant.sync_variant_id);
 console.log({checkoutStatus:r.status,account:intent.metadata.printful_store_id,fulfillmentVariantMatches:true,subtotal:result.subtotalCents,shipping:result.shippingCents,tax:result.taxCents,paymentConfirmed:false});
 }finally{const canceled=await stripe.paymentIntents.cancel(id);console.log({testPaymentIntentCanceled:canceled.status==='canceled'});}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
