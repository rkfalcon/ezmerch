import {createAdminClient} from '../lib/supabase/admin';
import {PrintfulClient} from '../lib/lineup/printful';
import {templateColors} from '../lib/lineup/color-limit';
import {writeFileSync} from 'node:fs';
async function main(){
 const {data,error}=await createAdminClient().from('product_templates').select('id,title,catalog_product_id,enabled_colors');if(error)throw error;
 const updates=[];const client=new PrintfulClient();
 for(const t of data??[]){if(!t.catalog_product_id)continue;
 const catalog=await client.product(t.catalog_product_id);await createAdminClient().from("lineup_preview_templates").upsert({id:`catalog:${t.catalog_product_id}`,payload:catalog,updated_at:new Date().toISOString()});const colors=templateColors(catalog.variants,t.enabled_colors);
 if(!colors.length)throw Error(`No colors for ${t.title}`);
 updates.push({id:t.id,colors,previous:t.enabled_colors});
 console.log(JSON.stringify({title:t.title,previous:t.enabled_colors?.length??'all',enabled:colors.length,total:new Set(catalog.variants.map(v=>v.color)).size}));
 }
 writeFileSync('/tmp/ez-color-cap-backfill.json',JSON.stringify(updates,null,2));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
