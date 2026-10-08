import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServerClient} from '@supabase/ssr';
import {createAdminClient} from '../lib/supabase/admin';
import {dashboardColors, colorName, type ColorVariant} from '../lib/product-colors';
async function main(){
 const db=createAdminClient(),password=randomUUID()+randomUUID();
 const {data,error}=await db.auth.admin.createUser({email:`color-test-${randomUUID()}@example.invalid`,password,email_confirm:true});if(error||!data.user)throw error;
 const user=data.user,cookies=new Map<string,string>();
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:user.email!,password});if(login)throw login;
  const url='https://www.verymerch.com/api/products/eb9b2986-505d-4d0c-bf4e-914c76c4f9c3/colors';
  const headers=()=>({cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')});
  assert.equal((await fetch(url,{headers:headers()})).status,403);
  const {error:role}=await db.from('user_roles').insert({user_id:user.id,role:'admin'});if(role)throw role;
  const response=await fetch(url,{headers:headers()});assert.equal(response.status,200);
  const p=await response.json();const variants=p.variants as ColorVariant[];
  const colors=dashboardColors([...new Set(variants.map(colorName))],true,p.global_active,p.global_enabled_colors);
  assert.equal(colors.length,25);assert.deepEqual([...colors].sort(),[...p.global_enabled_colors].sort());
  const image=variants.find(v=>v.color===p.default_color)?.image_url;assert.ok(image);
  assert.equal((await fetch(image,{method:'HEAD'})).status,200);
  console.log({liveDashboardApi:true,ownerVisibleColors:colors.length,defaultColor:p.default_color,defaultImageAccessible:true,unrelatedUserDenied:true});
 }finally{await client.auth.signOut();await db.from('user_roles').delete().eq('user_id',user.id);const {error:cleanup}=await db.auth.admin.deleteUser(user.id);if(cleanup)throw cleanup;}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
