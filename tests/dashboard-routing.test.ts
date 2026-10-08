import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

async function destination(user: unknown, store: unknown = null) {
  let queries = 0;
  const query = {
    select() { return query; },
    eq(_column: string, value: unknown) { if (value == null) throw Error('Invalid UUID'); return query; },
    order() { return query; }, limit() { return query; },
    async maybeSingle() { return {data: store, error: null}; },
  };
  const modules: Record<string, unknown> = {
    '@/lib/auth': {getUserWithRole: async () => user},
    '@/lib/supabase/admin': {createAdminClient: () => ({from: () => { queries++; return query; }})},
    'next/navigation': {redirect: (path: string) => { throw {path}; }},
  };
  const output = ts.transpileModule(readFileSync('app/(platform)/dashboard/page.tsx','utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports: {default?: () => Promise<void>} = {};
  new Function('require','exports',output)((name: string) => modules[name], exports);
  try { await exports.default!(); } catch (error) {
    if (error && typeof error === 'object' && 'path' in error) return {path: error.path, queries};
    throw error;
  }
}
test('confirmed account without a store opens setup without querying a null UUID',async()=>{
  assert.deepEqual(await destination({id:'new-user',isAdmin:false,storeId:null}),{path:'/dashboard/onboarding',queries:0});
});
test('existing owners and administrators retain their dashboard routes',async()=>{
  assert.deepEqual(await destination({id:'owner',isAdmin:false,storeId:'store'}, {id:'store',selling_enabled:true}),{path:'/dashboard/store',queries:1});
  assert.deepEqual(await destination({id:'admin',isAdmin:true,storeId:null}),{path:'/dashboard/admin/stores',queries:0});
  assert.deepEqual(await destination(null),{path:'/login',queries:0});
});
