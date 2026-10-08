/** Explicit production verification: review Sunday Sauce, then resume its held shirt. No orders or emails are sent by this script. */
import {createAdminClient} from "../lib/supabase/admin";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {writeFileSync,unlinkSync} from "node:fs";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const host="https://www.ezmerch.store",storeId="d261d4c2-6e4c-45d7-8941-9be8cd88b4e9";
async function main(){
 const db=createAdminClient(),password=randomUUID()+randomUUID();
 const {data:auth,error}=await db.auth.admin.createUser({email:`artwork-test-${randomUUID()}@example.invalid`,password,email_confirm:true});if(error||!auth.user)throw error;
 const uid=auth.user.id,cookies=new Map<string,string>(),stateFile="/tmp/ez-artwork-browser-state.json";
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const headers=()=>({"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")});
  const {data:job,error:je}=await db.from("product_generation_jobs").select("*").eq("store_id",storeId).ilike("template_snapshot->>title","%Garment-Dyed%").single();if(je)throw je;
  const query=new URLSearchParams({storeId,jobId:job.id,area:"1"});
  const denied=await fetch(host+"/api/lineup/review?"+query,{headers:headers()});assert.notEqual(denied.status,200);
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;
  const pdf=await fetch(host+"/api/lineup/review?"+query,{headers:headers()});assert.equal(pdf.status,200);assert.match(pdf.headers.get("content-type")??"",/pdf/);
  writeFileSync("/tmp/ez-production-review.pdf",Buffer.from(await pdf.arrayBuffer()));
  const invalid=await fetch(host+"/api/lineup/jobs",{method:"POST",headers:headers(),body:JSON.stringify({storeId,jobId:job.id,adjustment:{scale:.8,placement:"back"}})});assert.equal(invalid.status,400);
  console.log("Live access control, PDF download, and unsupported placement rejection passed.");
  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.ezmerch.store",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=ez-artwork-review",...args],{encoding:"utf8",timeout:60000});
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/stores/"+storeId);
  console.log(cli("run-code",`async page => {
    const buttons=page.getByRole('button',{name:'Review product placement & actual print size'});
    await buttons.first().waitFor();
    const row=page.locator('li').filter({hasText:'Unisex Garment-Dyed Heavyweight T-Shirt'}).first();
    await row.getByRole('button',{name:'Review product placement & actual print size'}).click();
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/ez-artwork-review-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/ez-artwork-review-mobile.png'});
    return {pdfLinks:await row.getByText('Download actual-size PDF for print area 1').count(),adjustButtons:await row.getByRole('button',{name:'Adjust & regenerate preview'}).count()};
  }`));
  cli("close");
  // Permit centered-front fallback for this template and its existing held snapshot.
  const {error:te}=await db.from("product_templates").update({allow_front_fallback:true}).eq("id",job.template_id);if(te)throw te;
  const {error:se}=await db.from("product_generation_jobs").update({template_snapshot:{...job.template_snapshot,allow_front_fallback:true}}).eq("id",job.id).eq("status","failed").eq("updated_at",job.updated_at).select("id").single();if(se)throw se;
  const retry=await fetch(host+"/api/lineup/jobs",{method:"POST",headers:headers(),body:JSON.stringify({storeId,jobId:job.id,prepareAgain:true})});assert.equal(retry.status,200,await retry.text());
  console.log("Sunday Sauce shirt queued for automatic reassessment; template permits centered-front fallback.");
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error("Cleanup failed",cleanup.message);
  try{unlinkSync(stateFile);}catch{}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
