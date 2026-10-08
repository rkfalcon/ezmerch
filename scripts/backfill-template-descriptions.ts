import {createAdminClient} from "../lib/supabase/admin";
import {PrintfulClient} from "../lib/lineup/printful";
import {productDescription} from "../lib/lineup/product-description";
async function main(){
 const db=createAdminClient(),client=new PrintfulClient();
 const {data:templates,error}=await db.from("product_templates").select("id,title,catalog_product_id,description");
 if(error)throw error;
 for(const t of templates??[]){
  if(t.description?.trim()||!t.catalog_product_id)continue;
  const catalog=await client.product(t.catalog_product_id);
  const description=productDescription(catalog.product.description);
  if(!description){console.log("No catalog description:",t.title);continue;}
  const {error:update}=await db.from("product_templates").update({description}).eq("id",t.id).eq("description",t.description);
  if(update)throw update;
  const {data:products,error:verify}=await db.from("products").select("description").eq("template_id",t.id);
  if(verify||products?.some(p=>p.description!==description))throw Error("Description propagation failed");
  console.log(t.title,description.length,"characters;",products?.length??0,"products verified");
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
