/** Explicit live test: hidden store, checkout disabled, no invitations or orders. */
import {createAdminClient} from '../lib/supabase/admin';
import {createServerClient} from '@supabase/ssr';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
async function main(){
 const db=createAdminClient();const host='https://www.ezmerch.store';
 const password=randomUUID()+randomUUID();
 const {data:auth,error:ae}=await db.auth.admin.createUser({email:`lineup-test-${randomUUID()}@example.invalid`,password,email_confirm:true});if(ae||!auth.user)throw ae??Error('Test auth failed');
 const uid=auth.user.id;let prepId:string|undefined;
 try{
  const {error:re}=await db.from('user_roles').insert({user_id:uid,role:'admin'});if(re)throw re;
  const cookies=new Map<string,string>();
  const client=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:rows=>rows.forEach(r=>cookies.set(r.name,r.value))}});
  const {error:se}=await client.auth.signInWithPassword({email:auth.user.email!,password});if(se)throw se;
  const request=async(path:string,init:RequestInit={})=>{const r=await fetch(host+path,{...init,headers:{...init.headers,cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},signal:AbortSignal.timeout(300000)});const body=await r.json();if(!r.ok)throw Error(`${path}: ${r.status} ${body.error}`);return body;};
  // Validate the deployed API refuses a 26th color before any data mutation.
  const {data:template}=await db.from('product_templates').select('id').ilike('title','%3001%').single();
  const detail=await request(`/api/lineup/templates/${template!.id}/colors`);
  const colors=[...new Set<string>(detail.variants.map((v:{color:string})=>v.color))];
  const blocked=await fetch(host+`/api/lineup/templates/${template!.id}/colors`,{method:'PATCH',headers:{'content-type':'application/json',cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')},body:JSON.stringify({colors:colors.slice(0,26)})});
  console.log('26-color API validation',blocked.status,(await blocked.json()).error);if(blocked.status!==400)throw Error('Color cap not enforced');
  const page=await fetch(host+'/dashboard/admin/templates',{headers:{cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join('; ')}});
  const html=await page.text();console.log('Admin cards',page.status,'cap instructions:',html.includes('maximum 25 colors'));
  const {data:store,error:ste}=await db.from('stores').insert({name:'Lineup speed test — Sunday Sauce',slug:`lineup-speed-test-${Date.now()}`,show_on_homepage:false,selling_enabled:false}).select('id,slug').single();if(ste)throw ste;
  const original=await db.storage.from('logo-originals').download('79ce1a37-9d06-457e-bcd8-3efcd36e2e15/97904b3d-ef86-47e3-8c1a-ace3792ad11a/original');if(original.error||!original.data)throw Error('Original unavailable');
  const start=Date.now();const report={storeId:store!.id,slug:store!.slug,start,uploadAcceptedAt:0,preparedAt:0};
  writeFileSync('/tmp/ez-lineup-live-test.json',JSON.stringify(report));
  const form=new FormData();form.set('logo',new File([await original.data.arrayBuffer()],'sunday-sauce.png',{type:'image/png'}));form.set('removeBackground','true');
  let prep=await request('/api/lineup/logo/prepare',{method:'POST',body:form});prepId=prep.id;
  console.log('Preparation started',{status:prep.status,seconds:(Date.now()-start)/1000});
  while(prep.status==='queued'&&Date.now()-start<180000){await new Promise(r=>setTimeout(r,3000));prep=await request(`/api/lineup/logo/enhance?id=${prepId}`);}
  if(prep.status==='queued'||prep.error)throw Error(prep.error??'Enhancement timeout');
  report.preparedAt=Date.now();console.log('Logo prepared',{status:prep.status,seconds:(Date.now()-start)/1000});
  const upload=new FormData();upload.set('storeId',store!.id);upload.set('preparationId',prepId!);
  await request('/api/lineup/logo',{method:'POST',body:upload});report.uploadAcceptedAt=Date.now();
  writeFileSync('/tmp/ez-lineup-live-test.json',JSON.stringify(report));
  console.log('Upload accepted', {...report,elapsedSeconds:(Date.now()-start)/1000});
 }finally{
  await db.from("user_roles").delete().eq("user_id",uid);
  await db.from("logo_preparations").delete().eq("user_id",uid);
  const {error}=await db.auth.admin.deleteUser(uid);if(error)console.error('Test user cleanup failed',error.message);
  if(prepId)await db.storage.from('logo-originals').remove([`${uid}/${prepId}/original`,`${uid}/${prepId}/clean.png`,`${uid}/${prepId}/enhanced.png`]);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
