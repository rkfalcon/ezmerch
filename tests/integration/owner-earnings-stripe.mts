/** Real Stripe sandbox + actual earnings worker + isolated PostgreSQL. No production DB or emails. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { createEarningsFixture } from '../helpers/earnings-database';
import { processOwnerEarnings } from '../../lib/earnings/worker';
import { EARNINGS_POLICY } from '../../lib/earnings/policy';
if(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))throw Error('Sandbox key required');
const stripe=new Stripe(process.env.STRIPE_SECRET_KEY,{apiVersion:'2026-03-25.dahlia'});
test('real sandbox: sale before setup → qualifying setup → owner transfer → refund reversal',async()=>{
 const {pg,db,sid,oid}=await createEarningsFixture();
 let payment:Stripe.PaymentIntent|undefined;
 try {
  const accounts=await stripe.accounts.list({limit:20});
  const account=accounts.data.find(a=>a.charges_enabled && a.payouts_enabled && a.capabilities?.transfers==='active');
  assert.ok(account,'A verified sandbox connected account is required');
  payment=await stripe.paymentIntents.create({amount:3700,currency:'usd',payment_method:'pm_card_visa',payment_method_types:['card'],confirm:true,metadata:{revenue_split_version:EARNINGS_POLICY,integration_test:'earnings',order_id:oid}});
  await pg.query('update orders set stripe_payment_intent_id=$1 where id=$2',[payment.id,oid]);
  await pg.query('select record_owner_earning($1,now(),1200)',[oid]);
  assert.equal((await processOwnerEarnings(1,db,stripe)).errors,0);
  assert.equal((await pg.query<{status:string}>('select status from owner_earnings')).rows[0].status,'pending');
  assert.equal((await pg.query('select * from notification_emails')).rows.length,1);
  await pg.query('update stores set stripe_account_id=$1 where id=$2',[account.id,sid]);
  await pg.query('select record_payout_readiness($1,now())',[account.id]);
  assert.equal((await processOwnerEarnings(1,db,stripe)).errors,0);
  const row=(await pg.query<{status:string,stripe_transfer_id:string}>('select * from owner_earnings')).rows[0];
  assert.equal(row.status,'transferred');
  const transfer=await stripe.transfers.retrieve(row.stripe_transfer_id);
  assert.equal(transfer.amount,1260);
  assert.equal(transfer.destination,account.id);
  await pg.exec('update owner_earnings set next_check_at=now()');
  await processOwnerEarnings(1,db,stripe);
  assert.equal((await stripe.transfers.list({transfer_group:`earnings_${oid}`})).data.length,1);
  await stripe.refunds.create({payment_intent:payment.id});
  await pg.exec('update owner_earnings set next_check_at=now()');
  assert.equal((await processOwnerEarnings(1,db,stripe)).errors,0);
  assert.equal((await stripe.transfers.retrieve(transfer.id)).amount_reversed,1260);
  assert.equal((await pg.query<{status:string}>('select status from owner_earnings')).rows[0].status,'refunded');
  console.log(JSON.stringify({sandbox:true,payment:payment.id,transfer:transfer.id,ownerShareCents:1260,fullyReversed:true}));
 } finally {
  if(payment){const charges=await stripe.charges.retrieve(payment.latest_charge as string);if(!charges.refunded)await stripe.refunds.create({payment_intent:payment.id});}
  await pg.close();
 }
});
