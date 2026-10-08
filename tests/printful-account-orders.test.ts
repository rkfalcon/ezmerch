import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrder,confirmOrder} from '../lib/printful';
import {POST as webhook} from '../app/api/webhooks/printful/route';
test('order creation and confirmation both keep the payment account',async()=>{
 const oldFetch=globalThis.fetch;const oldEnv={...process.env};
 Object.assign(process.env,{PRINTFUL_STORE_ID:'1',PRINTFUL_API_TOKEN:'old',PRINTFUL_NEXT_STORE_ID:'2',PRINTFUL_NEXT_API_TOKEN:'new',PRINTFUL_CONNECTION_SWITCH:'true'});
 const calls:{token:string|null;store:string|null}[]=[];
 globalThis.fetch=async(_url,init)=>{const h=new Headers(init?.headers);calls.push({token:h.get('Authorization'),store:h.get('X-PF-Store-Id')});return Response.json({result:{id:5}});};
 try{
 await createOrder({external_id:'test',recipient:{name:'Test',address1:'Test',city:'Test',state_code:'NY',country_code:'US',zip:'10001'},items:[{sync_variant_id:10,quantity:1}]},'1');
 await confirmOrder(5,'1');
 assert.deepEqual(calls,[{token:'Bearer old',store:'1'},{token:'Bearer old',store:'1'}]);
 }finally{globalThis.fetch=oldFetch;process.env=oldEnv;}
});
test('order webhook rejects missing secrets and unknown account IDs',async()=>{
 const oldEnv={...process.env};Object.assign(process.env,{PRINTFUL_ORDER_WEBHOOK_SECRET:'secret',PRINTFUL_STORE_ID:'1',PRINTFUL_NEXT_STORE_ID:'2'});
 try{
 assert.equal((await webhook(new Request('https://example.com/api',{method:'POST',body:'{}'}))).status,401);
 assert.equal((await webhook(new Request('https://example.com/api?token=secret',{method:'POST',body:JSON.stringify({store:3})}))).status,401);
 }finally{process.env=oldEnv;}
});
