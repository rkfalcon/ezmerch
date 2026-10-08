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
 const uid=auth.user.id,cookies=new Map<string,string>(),stateFile="/tmp/lineup-progress-browser-state.json";
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const headers=()=>({"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  const denied=await fetch(host+"/api/lineup/quality-settings",{headers:headers()});
  assert.equal(denied.status,403);
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;

  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.verymerch.com",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=lineup-progress",...args],{encoding:"utf8",timeout:240000});
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/stores/d9870429-da7b-4d85-82e6-46e383d6dab5");
  const result=cli("run-code",`async page => {
    await page.getByText(/of .* products have their first color ready/).waitFor();
    const response=await page.request.get('https://www.verymerch.com/api/lineup/jobs?storeId=d9870429-da7b-4d85-82e6-46e383d6dab5');
    if(!response.ok())throw Error('Progress API failed');
    const data=await response.json();
    if(!data.jobs.every(j=>j.progress && j.progress.readyColors<=j.progress.totalColors))throw Error('Invalid progress counts');
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      await page.getByText(/of .* products have their first color ready/).scrollIntoViewIfNeeded();
      await page.screenshot({path:'/tmp/verymerch-lineup-progress-'+width+'.png'});
    }
    return {progressVisible:true,countsValid:true,jobs:data.jobs.length};
  }`);
  if(result.includes('### Error'))throw Error(result);
  console.log(result);cli("close");
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error("Cleanup failed",cleanup.message);
  try{unlinkSync(stateFile);}catch{}
 }
}
main().catch(e=>{console.error(e.stdout?.toString() || e.message);process.exitCode=1});
