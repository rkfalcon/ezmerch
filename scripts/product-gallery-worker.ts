import {runProductGalleryWorker} from '../lib/lineup/gallery-worker';
import {createAdminClient} from '../lib/supabase/admin';
async function main(){
 const deadline=Date.now()+60*60_000;
 do {
  console.log(await runProductGalleryWorker());
  if(process.argv.includes('--once'))break;
  const {count,error}=await createAdminClient().from('product_gallery_jobs').select('id',{head:true,count:'exact'}).in('status',['pending','running']);
  if(error)throw error;
  if(!count){console.log('Gallery queue finished');break;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }while(Date.now()<deadline);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
