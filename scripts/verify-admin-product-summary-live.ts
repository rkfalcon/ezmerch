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
 const uid=auth.user.id,cookies=new Map<string,string>(),stateFile="/tmp/admin-summary-browser-state.json";
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const headers=()=>({"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  const denied=await fetch(host+"/api/products/6647ea03-3a26-4677-b64d-68f5d23617b4/earnings",{headers:headers()});
  assert.equal(denied.status,403);
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;

  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.verymerch.com",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=admin-product-summary",...args],{encoding:"utf8",timeout:240000});
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/stores/d9870429-da7b-4d85-82e6-46e383d6dab5");
  const result=cli("run-code",`async page => {
    const response=await page.request.get('https://www.verymerch.com/api/lineup/jobs?storeId=d9870429-da7b-4d85-82e6-46e383d6dab5');
    if(!response.ok())throw Error('Jobs API failed');
    const data=await response.json();
    const job=data.jobs.find(j=>j.product?.id==='6647ea03-3a26-4677-b64d-68f5d23617b4');
    if(!job?.product?.image)throw Error('Default product image missing');
    const image=page.locator('li img[src='+JSON.stringify(job.product.image)+']').first();
    await image.waitFor();
    const card=image.locator('..');
    await card.getByText(/Selling price:/).waitFor();
    await card.getByText(/Estimated owner earnings: .[0-9]/).waitFor();
    await image.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/verymerch-admin-product-summary.png'});
    return {ownerThumbnailVisible:true,savedPriceVisible:true,earningsVisible:true};
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
