import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {defaultQualityValues} from '../lib/lineup/quality-policy';
test('quality settings are private, seeded with matching defaults, audited and concurrency protected',async()=>{
 const db=new PGlite();
 try{
  await db.exec('create role anon;create role authenticated;create role service_role;create schema private;create schema auth;create table auth.users(id uuid primary key);');
  await db.exec(readFileSync('supabase/migrations/20260923205233_artwork_quality_settings.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20260925220000_transparency_outlier_limits.sql','utf8'));
  assert.deepEqual((await db.query<{values:unknown}>('select values from artwork_quality_settings')).rows[0].values,defaultQualityValues);
  await db.exec(`update artwork_quality_settings set values=jsonb_set(values,'{printTextMm}','0.9') where revision=2;`);
  assert.equal((await db.query<{revision:number}>('select revision from artwork_quality_settings')).rows[0].revision,3);
  assert.equal((await db.query('select * from artwork_quality_settings_history')).rows.length,3);
  assert.equal((await db.query('update artwork_quality_settings set values=values where revision=1 returning revision')).rows.length,0);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from artwork_quality_settings'));
  await assert.rejects(db.query('update artwork_quality_settings set values=values'));
 }finally{await db.close();}
});
