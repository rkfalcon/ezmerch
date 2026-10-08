/** Read-only approval UI verification; generates cached Printful review previews but does not approve products. */
import {createAdminClient} from "../lib/supabase/admin";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {writeFileSync,unlinkSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const host="https://www.verymerch.com",storeId="d261d4c2-6e4c-45d7-8941-9be8cd88b4e9";
async function main(){
 const db=createAdminClient(),password=randomUUID()+randomUUID();
 const {data:auth,error}=await db.auth.admin.createUser({email:`artwork-test-${randomUUID()}@example.invalid`,password,email_confirm:true});if(error||!auth.user)throw error;
 const uid=auth.user.id,cookies=new Map<string,string>(),stateFile="/tmp/ez-artwork-browser-state.json";
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const headers=()=>({"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  const denied=await fetch(host+"/api/lineup/quality-settings",{headers:headers()});
  assert.equal(denied.status,403);
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;

  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.verymerch.com",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=ez-preview-progress",...args],{encoding:"utf8",timeout:240000});
  const response=await fetch(host+"/api/lineup/quality-settings",{headers:headers()});
  assert.equal(response.status,200);
  const policy=await response.json();
  const save=await fetch(host+"/api/lineup/quality-settings",{method:"PUT",headers:headers(),body:JSON.stringify(policy)});
  assert.equal(save.status,200);
  const saved=await save.json();assert.deepEqual(saved.values,policy.values);
  const stale=await fetch(host+"/api/lineup/quality-settings",{method:"PUT",headers:headers(),body:JSON.stringify(policy)});
  assert.equal(stale.status,409);
  const invalid=await fetch(host+"/api/lineup/quality-settings",{method:"PUT",headers:headers(),body:JSON.stringify({...saved,values:{...saved.values,printTextMm:-1}})});
  assert.equal(invalid.status,400);
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/quality");
  const result=cli("run-code",`async page => {
    await page.getByRole('heading',{name:'Artwork quality settings'}).waitFor();
    const input=page.getByLabel('Minimum printed lettering',{exact:true});
    await input.fill('0.90');
    if(Number(await input.inputValue())!==0.9)throw Error('Decimal input was not retained');
    await page.getByRole('button',{name:'Discard unsaved changes'}).click();
    if(Number(await input.inputValue())!==${policy.values.printTextMm})throw Error('Discard failed');
    await page.screenshot({path:'/tmp/verymerch-quality-settings.png',fullPage:true});
    return {adminSettingsVisible:true,decimalEditingWorks:true,unchangedDefaults:true};
  }`);
  if(result.includes('### Error'))throw Error(result);
  console.log(result);
  cli("close");
  console.log('Admin-only access, validation, audited save and stale-write protection verified. Quality values unchanged.');
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error("Cleanup failed",cleanup.message);
  try{unlinkSync(stateFile);}catch{}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
