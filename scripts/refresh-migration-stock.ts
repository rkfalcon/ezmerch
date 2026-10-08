import {createAdminClient} from '../lib/supabase/admin';
import {readStock} from '../lib/lineup/availability';
async function main(){
 const db=createAdminClient();const {data:templates,error}=await db.from('product_templates').select('id,title,catalog_product_id,technique').not('catalog_product_id','is',null);if(error)throw error;
 for(const t of templates!){
 const stock=await readStock(t.catalog_product_id,t.technique);
 // Correct the migration's account-default refresh without generating artificial restock notices.
 const {error:te}=await db.from('product_templates').update({supplier_stock:stock,stock_check_error:null,stock_next_check_at:new Date(Date.now()+15*60_000).toISOString()}).eq('id',t.id);if(te)throw te;
 const {error:pe}=await db.from('products').update({supplier_stock:stock}).eq('template_id',t.id);if(pe)throw pe;
 console.log({product:t.title,available:stock.available.length,unavailable:stock.unavailable.length});
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
