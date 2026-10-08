import test from 'node:test';
import assert from 'node:assert/strict';
import {previewMetadata} from '../lib/lineup/preview-cache';
import type {createAdminClient} from '../lib/supabase/admin';

test('fresh preview metadata bypasses supplier; expired entries refresh once',async()=>{
 let updated_at=new Date().toISOString(),loads=0,writes=0;
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{payload:{id:1},updated_at}};},async upsert(){writes++;return {error:null};}};
 const db={from(){return query;}} as unknown as ReturnType<typeof createAdminClient>;
 const load=async()=>{loads++;return {id:2};};
 assert.deepEqual(await previewMetadata(db,'test',load),{id:1});assert.equal(loads,0);
 updated_at='2020-01-01';assert.deepEqual(await previewMetadata(db,'test',load),{id:2});assert.equal(loads,1);assert.equal(writes,1);
});
