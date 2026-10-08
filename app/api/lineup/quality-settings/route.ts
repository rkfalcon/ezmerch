import {lineupAdmin} from '@/lib/lineup/access';
import {createAdminClient} from '@/lib/supabase/admin';
import {validateQualityValues} from '@/lib/lineup/quality-policy';
import {loadQualityPolicy} from '@/lib/lineup/quality-policy-store';
export async function GET(){
 try{await lineupAdmin();}catch{return Response.json({error:'Admin access required'},{status:403});}
 try{return Response.json(await loadQualityPolicy(createAdminClient()));}catch{return Response.json({error:'Settings unavailable'},{status:503});}
}
export async function PUT(request:Request){
 let user;
 try{user=await lineupAdmin();}catch{return Response.json({error:'Admin access required'},{status:403});}
 try{
  const body=await request.json();
  const values=validateQualityValues(body.values);
  if(!Number.isInteger(body.revision)||body.revision<1)throw Error('Invalid settings revision. Reload the page.');
  const {data,error}=await createAdminClient().from('artwork_quality_settings')
   .update({values,updated_by:user.id}).eq('id',1).eq('revision',body.revision).select('revision,values').maybeSingle();
  if(error)return Response.json({error:'Could not save settings. Please try again.'},{status:500});
  if(!data)return Response.json({error:'Another admin changed these settings. Reload the page before saving.'},{status:409});
  return Response.json(data);
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Invalid settings'},{status:400});}
}
