/** Read-only approval UI verification; generates cached Printful review previews but does not approve products. */
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
  const {data:job,error:je}=await db.from("product_generation_jobs").select("*").eq("store_id",storeId).ilike("template_snapshot->>title","%W101%").single();if(je)throw je;
  const query=new URLSearchParams({storeId,jobId:job.id,area:"1"});
  const denied=await fetch(host+"/api/lineup/review?"+query,{headers:headers()});assert.notEqual(denied.status,200);
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;
  const pdf=await fetch(host+"/api/lineup/review?"+query,{headers:headers()});
  assert.equal(pdf.status,400);
  assert.match((await pdf.json()).error,/Embroidery reviews/);
  if(!job.review_mockup?.image){
   const approval=await fetch(host+"/api/lineup/jobs",{method:"POST",headers:headers(),body:JSON.stringify({storeId,jobId:job.id,approveQuality:true})});
   assert.equal(approval.status,400);
   assert.match((await approval.json()).error,/Wait for the Printful embroidery mockup/);
  }
  console.log("Embroidery PDF blocked; missing-preview approval blocked.");
  writeFileSync(stateFile,JSON.stringify({cookies:[...cookies].map(([name,value])=>({name,value,domain:"www.ezmerch.store",path:"/",httpOnly:false,secure:true,sameSite:"Lax",expires:-1})),origins:[]}),{mode:0o600});
  const cli=(...args:string[])=>execFileSync("npx",["--yes","--package","@playwright/cli","playwright-cli","-s=ez-embroidery-review",...args],{encoding:"utf8",timeout:240000});
  cli("open",host);cli("state-load",stateFile);cli("goto",host+"/dashboard/admin/stores/"+storeId);
  console.log(cli("run-code",`async page => {
    const row=page.locator('li').filter({hasText:'Cotton Color Tote Bag | Westford Mill W101'}).first();
    const image=row.getByRole('img',{name:'Embroidery mockup for approval'});
    await image.waitFor({timeout:180000});
    await image.evaluate(async img => { if(!img.complete)await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject}); });
    const checkbox=row.getByRole('checkbox');
    const approve=row.getByRole('button',{name:'Approve embroidery & continue'});
    const before=await approve.isDisabled();
    await checkbox.check();
    const after=await approve.isEnabled();
    const pdfs=await row.getByText('Download actual-size PDF',{exact:false}).count();
    const manual=await row.getByRole('button',{name:'Generate product review mockup'}).count();
    if(!before||!after||pdfs||manual)throw new Error('Embroidery review controls incorrect');
    await row.scrollIntoViewIfNeeded();
    await page.screenshot({path:'/tmp/ez-embroidery-default-review.png'});
    await page.reload();
    const cached=page.locator('li').filter({hasText:'Cotton Color Tote Bag | Westford Mill W101'}).first().getByRole('img',{name:'Embroidery mockup for approval'});
    await cached.waitFor({timeout:15000});
    return {pdfs,manual,approvalEnabledAfterCheck:after,cachedAfterReload:true};
  }`));
  cli("close");
  const {data:held}=await db.from("product_generation_jobs").select("status,state,review_mockup").eq("id",job.id).single();
  assert.equal(held?.status,"failed");
  assert.ok(!held?.state.printQuality.reviewedAt);
  assert.ok(held?.review_mockup.image);
  console.log("Automatic embroidered mockup loaded and reused after refresh. Product remains unapproved.");
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error("Cleanup failed",cleanup.message);
  try{unlinkSync(stateFile);}catch{}
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
