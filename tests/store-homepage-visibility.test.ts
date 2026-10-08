import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('homepage visibility defaults on and only admins can change it', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      create schema auth; create schema private;
      create function auth.role() returns text language sql as $$ select current_setting('test.role',true) $$;
      create function private.lineup_admin() returns boolean language sql as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
      create table stores(id int primary key, name text);
      insert into stores values(1,'Existing');`);
    await db.exec(readFileSync('supabase/migrations/20260919211958_store_homepage_visibility.sql','utf8'));
    assert.equal((await db.query<{show_on_homepage:boolean}>('select show_on_homepage from stores')).rows[0].show_on_homepage,true);
    await db.exec("set test.role='authenticated'; set test.admin='false'; update stores set name='Owner edit' where id=1;");
    await assert.rejects(db.exec('update stores set show_on_homepage=false where id=1'),/Only admins/);
    await assert.rejects(db.exec("insert into stores values(2,'Hidden',false)"),/Only admins/);
    await db.exec("set test.admin='true'; update stores set show_on_homepage=false where id=1;");
    assert.equal((await db.query('select * from stores where show_on_homepage')).rows.length,0);
    assert.equal((await db.query('select * from stores where id=1')).rows.length,1);
    await db.exec('update stores set show_on_homepage=true where id=1');
    assert.equal((await db.query('select * from stores where show_on_homepage')).rows.length,1);
  } finally { await db.close(); }
});
