import {createAdminClient} from '../lib/supabase/admin';
import {selectedGallery, type GalleryImage} from '../lib/lineup/gallery';
async function main(){
 const db=createAdminClient();
 const {data:jobs,error}=await db.from('product_gallery_jobs').select('id,status,state,last_error,product_id');if(error)throw error;
 const {data:products,error:pe}=await db.from('products').select('id,title,variants,gallery_images,global_enabled_colors,stores(slug)');if(pe)throw pe;
 const report=(jobs??[]).map(j=>{
  const p=products!.find(p=>p.id===j.product_id)!;
  const variants=(p.variants as {variant_id:number;color:string;image_url:string}[]).filter(v=>!p.global_enabled_colors||p.global_enabled_colors.includes(v.color));
  const colors=[...new Set(variants.map(v=>v.color))];
  const completeColors=(j.state.styles?.length && !j.state.unavailable ? colors : []).filter(c=>variants.filter(v=>v.color===c).every(v=>selectedGallery(v.image_url,v.variant_id,p.gallery_images as GalleryImage[]).length===1+(j.state.styles?.length??0)));
  return {store:p.stores,product:p.title,status:j.status,unsupported:!!j.state.unavailable,colors:colors.length,readyColors:completeColors.length,images:p.gallery_images.length,error:j.last_error};
 });
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
