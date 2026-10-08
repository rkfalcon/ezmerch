/** Production API test on the hidden, checkout-disabled test store. */
import {createAdminClient} from "../lib/supabase/admin";
import {createServerClient} from "@supabase/ssr";
import {randomUUID} from "node:crypto";
import {writeFileSync} from "node:fs";
import assert from "node:assert/strict";
async function main(){
 const db=createAdminClient(),host="https://www.ezmerch.store";
 const storeId="85bc83d2-0f39-450a-8c30-69395b9bf52d";
 const password=randomUUID()+randomUUID();
 const {data:auth,error}=await db.auth.admin.createUser({email:`review-mockup-${randomUUID()}@example.invalid`,password,email_confirm:true});if(error||!auth.user)throw error;
 const uid=auth.user.id,cookies=new Map<string,string>();
 const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
 try{
  const {error:role}=await db.from("user_roles").insert({user_id:uid,role:"admin"});if(role)throw role;
  const {error:login}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(login)throw login;
  const {data:job,error:je}=await db.from("product_generation_jobs").select("id").eq("store_id",storeId).ilike("template_snapshot->>title","%Garment-Dyed%").single();if(je)throw je;
  const headers={"Content-Type":"application/json",cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")};
  let taskKey:string|undefined,finished=false;
  for(let i=0;i<24;i++){
   const response=await fetch(host+"/api/lineup/review",{method:"POST",headers,body:JSON.stringify({storeId,jobId:job.id,taskKey})});
   const result=await response.json();
   if(!response.ok){
    if(response.status===429||response.status===409){console.log("Review mockup waiting",response.status,result.error);await new Promise(r=>setTimeout(r,15000));continue;}
    throw Error(result.error);
   }
   if(result.task_key){taskKey=result.task_key;console.log("Review-only Printful task submitted");}
   if(result.status==="failed")throw Error(result.error);
   if(result.status==="completed"){
    assert.ok(result.mockups?.[0]?.mockup_url);
    writeFileSync("/tmp/ez-review-mockup-result.json",JSON.stringify({mockup:result.mockups[0].mockup_url}));
    finished=true;break;
   }
   await new Promise(r=>setTimeout(r,10000));
  }
  assert.equal(finished,true,"Printful review task should finish");
  const {data:held}=await db.from("product_generation_jobs").select("status,state").eq("id",job.id).single();
  assert.equal(held?.status,"failed");assert.ok(!held?.state.publishedVariantCount);
  console.log("Actual Printful review mockup ready; no publication or approval occurred.");
  const adjust=await fetch(host+"/api/lineup/jobs",{method:"POST",headers,body:JSON.stringify({storeId,jobId:job.id,adjustment:{scale:.7,placement:"front"}})});
  assert.equal(adjust.status,200,await adjust.text());
  console.log("Valid admin adjustment accepted on hidden test store.");
 }finally{
  await client.auth.signOut();
  await db.from("user_roles").delete().eq("user_id",uid);
  const {error:cleanup}=await db.auth.admin.deleteUser(uid);if(cleanup)console.error(cleanup.message);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
