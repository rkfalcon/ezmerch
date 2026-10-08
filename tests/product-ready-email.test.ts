import test from 'node:test';
import assert from 'node:assert/strict';
import {productReadyEmail} from '../lib/lineup/product-ready-email';
const input={storeName:'Mazel & List',storeSlug:'mazellist',productTitle:'Classic Dad Hat | Yupoong',imageUrl:'https://example.com/mazellist-hat.png',dashboardPath:'/dashboard/store/products',origin:'https://www.verymerch.com',published:false};
test('new product email includes branded preview, owner action and store-specific link',()=>{
 const email=productReadyEmail(input);
 assert.match(email.html,/Mazel &amp; List/);
 assert.match(email.html,/src="https:\/\/example.com\/mazellist-hat.png"/);
 assert.match(email.text,/https:\/\/www.verymerch.com\/mazellist/);
 assert.match(email.text,/https:\/\/www.verymerch.com\/dashboard\/store\/products/);
 assert.match(email.text,/saved as a draft/);
 assert.doesNotMatch(email.html,/Printful/);
});
test('email escapes user artwork names and rejects unsafe image URLs',()=>{
 assert.doesNotMatch(productReadyEmail({...input,storeName:'<script>alert(1)</script>'}).html,/<script>/);
 assert.throws(()=>productReadyEmail({...input,imageUrl:'javascript:alert(1)'}),/HTTPS/);
 assert.throws(()=>productReadyEmail({...input,dashboardPath:'https://evil.example'}),/dashboard/);
});
test('already enabled products do not tell owners to enable them again',()=>{
 assert.match(productReadyEmail({...input,published:true}).text,/already enabled/);
 assert.doesNotMatch(productReadyEmail({...input,published:true}).text,/saved as a draft/);
});
