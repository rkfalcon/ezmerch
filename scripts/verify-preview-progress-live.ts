/** Read-only approval UI verification; generates cached Printful review previews but does not approve products. */
import {createAdminClient} from "../lib/supabase/admin";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {writeFileSync,unlinkSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const host="https://www.ezmerch.store",storeId="85bc83d2-0f39-450a-8c30-69395b9bf52d";
async function main(){
 const db=createAdminClient(),password=randomUUID()+randomUUID();
 const {data:auth,error}=await db.auth.admin.createUser({email:`artwork-test-${randomUUID()}@example.invalid`,password,email_confirm:true});if(error||!auth.user)throw error;
 const uid=auth.user.id,cookies=new Map<string,string>(),stateFile="/tmp/ez-artwork-browser-state.json";
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const headers=()=>({"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  const {data:job,error:je}=await db.from("product_generation_jobs").select("*").eq("store_id",storeId).ilike("template_snapshot->>title","%W101%").single();if(je)throw je;
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;
  assert.equal(job.status,"failed");
  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.ezmerch.store",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=ez-preview-progress",...args],{encoding:"utf8",timeout:240000});
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/stores/"+storeId);
  console.log(cli("run-code",`async page => {
    const row=page.locator('li').filter({hasText:'Cotton Color Tote Bag | Westford Mill W101'}).first();
    const before=await row.getByRole('img',{name:'Embroidery mockup for approval'}).getAttribute('src').catch(()=>null);
    await row.getByRole('spinbutton').fill('65');
    await row.getByRole('button',{name:'Adjust & regenerate preview'}).click();
    await row.getByText('Checking artwork and preparing the adjusted placement…').waitFor({timeout:15000});
    await page.screenshot({path:'/tmp/ez-preview-progress-checking.png'});
    const image=row.getByRole('img',{name:'Embroidery mockup for approval'});
    await image.waitFor({timeout:180000});
    await image.evaluate(async img => { if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject}); });
    const after=await image.getAttribute('src');
    if(!after||after===before)throw new Error('Updated image did not replace previous preview');
    await row.getByText('Preview ready — review the updated logo and placement above.').waitFor();
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/ez-preview-progress-ready.png'});
    return {updatedWithoutReload:true,approvalStillRequired:await row.getByRole('button',{name:'Approve embroidery & continue'}).isDisabled()};
  }`));
  cli("close");
  const {data:held}=await db.from("product_generation_jobs").select("status,state,review_mockup").eq("id",job.id).single();
  assert.equal(held?.status,"failed");
  assert.ok(!held?.state.printQuality.reviewedAt);
  assert.ok(held?.review_mockup.image);
  console.log("Adjusted embroidery preview updated without refresh. Product remains unapproved.");
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error("Cleanup failed",cleanup.message);
  try{unlinkSync(stateFile);}catch{}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
