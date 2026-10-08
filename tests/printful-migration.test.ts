import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateSyncState} from '../lib/lineup/migrate-sync-state';
import {printfulCredentials} from '../lib/printful-connection';
test('migration rewrites fulfillment IDs while retaining artwork, prices, and catalog IDs',()=>{
 const state={productId:71,syncId:10,printQuality:{status:'ready'},batches:[{taskKey:'old-account-task',images:[{url:'mockup',variant_ids:[50]}],artworkUrl:'logo',syncProducts:[{sync_product:{id:10},sync_variants:[{id:20,variant_id:50,synced:true}]}]}]};
 const result=migrateSyncState(state,{'10':{id:100,variants:{'20':200}}});
 assert.deepEqual(result,{...state,syncId:100,batches:[{images:[{url:'mockup',variant_ids:[50]}],artworkUrl:'logo',syncProducts:[{sync_product:{id:100},sync_variants:[{id:200,variant_id:50,synced:true}]}]}]});
 assert.equal(state.batches[0].taskKey,'old-account-task');
 assert.throws(()=>migrateSyncState(state,{}),/Missing/);
});
test('explicit old checkout account stays on original credentials after migration',async()=>{
 const keys=['PRINTFUL_STORE_ID','PRINTFUL_API_TOKEN','PRINTFUL_NEXT_STORE_ID','PRINTFUL_NEXT_API_TOKEN','PRINTFUL_CONNECTION_SWITCH'];
 const before=keys.map(k=>process.env[k]);
 try{Object.assign(process.env,{PRINTFUL_STORE_ID:'1',PRINTFUL_API_TOKEN:'old',PRINTFUL_NEXT_STORE_ID:'2',PRINTFUL_NEXT_API_TOKEN:'new',PRINTFUL_CONNECTION_SWITCH:'true'});
 assert.deepEqual(await printfulCredentials('1'),{storeId:'1',token:'old'});
 assert.deepEqual(await printfulCredentials('2'),{storeId:'2',token:'new'});
 await assert.rejects(printfulCredentials('unknown'),/unavailable/);
 }finally{keys.forEach((k,i)=>{if(before[i]===undefined)delete process.env[k];else process.env[k]=before[i];});}
});
