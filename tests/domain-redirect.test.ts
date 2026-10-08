import {test} from 'node:test';
import assert from 'node:assert/strict';
import {domainRedirect} from '../lib/domain-redirect';
test('domain migration preserves store paths and queries without redirecting webhooks or auth callbacks',()=>{
 assert.equal(domainRedirect('https://www.ezmerch.store/sundaysauce/products/123?color=red','GET'),'https://www.verymerch.com/sundaysauce/products/123?color=red');
 for(const url of ['https://www.ezmerch.store/api/webhooks/stripe','https://www.ezmerch.store/auth/callback?code=x','https://www.ezmerch.store/?token_hash=x','https://www.ezmerch.store/update-password','https://www.verymerch.com/login','http://localhost:3000/login']) assert.equal(domainRedirect(url,'GET'),null);
 assert.equal(domainRedirect('https://www.ezmerch.store/dashboard','POST'),null);
});
