import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync,readFileSync,existsSync} from 'node:fs';
import {createAdminClient} from '../lib/supabase/admin';
async function main(){
 const file='/tmp/verymerch-printful-migration/webhook-secret.json';
 const secrets=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):{order:randomBytes(32).toString('hex')};
 writeFileSync(file,JSON.stringify(secrets),{mode:0o600});
 async function req(prefix:string,path:string,body:unknown){const r=await fetch('https://api.printful.com'+path,{method:'POST',headers:{Authorization:`Bearer ${process.env[prefix+'_API_TOKEN']}`,'X-PF-Store-Id':process.env[prefix+'_STORE_ID']!,'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(`Webhook setup failed: ${r.status}`);return j.result??j.data;}
 if(!secrets.stock){
 const {data,error}=await createAdminClient().from('product_templates').select('catalog_product_id').not('catalog_product_id','is',null);if(error)throw error;
 const ids=[...new Set(data.map(t=>t.catalog_product_id))];
 const result=await req('PRINTFUL_NEXT','/v2/webhooks',{default_url:'https://www.verymerch.com/api/webhooks/printful-stock',events:[{type:'catalog_stock_updated',params:[{name:'products',value:ids.map(id=>({id}))}]}]});
 if(!result.secret_key)throw Error('Missing signing key');secrets.stock=result.secret_key;writeFileSync(file,JSON.stringify(secrets),{mode:0o600});
 }
 for(const [name,value] of [['PRINTFUL_ORDER_WEBHOOK_SECRET',secrets.order],['PRINTFUL_NEXT_STOCK_WEBHOOK_SECRET',secrets.stock],['PRINTFUL_CONNECTION_SWITCH','true']]){
 const r=spawnSync('/Users/kelly/Library/pnpm/vercel',['env','add',name,'production','--force','--yes','--scope','9i9e'],{input:value,encoding:'utf8'});if(r.status!==0)throw Error('Environment update failed: '+name);console.log(name+' configured');
 }
 if(process.argv.includes('--orders'))for(const prefix of ['PRINTFUL','PRINTFUL_NEXT']){
 await req(prefix,'/webhooks',{url:`https://www.verymerch.com/api/webhooks/printful?token=${secrets.order}`,types:['package_shipped','order_failed','order_canceled']});console.log(prefix+' order webhooks configured');
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
