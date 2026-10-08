import test from 'node:test';
import assert from 'node:assert/strict';
import {storeLaunchEmail} from '../lib/lineup/store-launch-email';
test('launch email explains selling without Stripe and exact earnings deadline',()=>{
 const email=storeLaunchEmail({name:'Dinerpedia',launched:false,payoutReady:false,reminder:false,origin:'https://www.verymerch.com'});
 assert.match(email.text,/without completing Stripe/);assert.match(email.text,/70%/);assert.match(email.text,/30%/);assert.match(email.text,/30 days of each sale/);
 assert.match(email.text,/https:\/\/www.verymerch.com\/dashboard\/onboarding/);
 assert.match(email.text,/retains/);
});
test('reminders only request outstanding steps',()=>{
 const launched=storeLaunchEmail({name:'Store',launched:true,payoutReady:false,reminder:true,origin:'https://www.verymerch.com'});
 assert.doesNotMatch(launched.text,/Launch your store:/);assert.match(launched.text,/Set up payouts:/);
 const ready=storeLaunchEmail({name:'Store',launched:false,payoutReady:true,reminder:true,origin:'https://www.verymerch.com'});
 assert.match(ready.text,/Launch your store:/);assert.doesNotMatch(ready.text,/Set up payouts:/);
});
