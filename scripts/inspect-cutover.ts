import {createAdminClient} from '../lib/supabase/admin';
import {PrintfulClient} from '../lib/lineup/printful';
async function main(){const db=createAdminClient();for(const table of ['store_invitation_template','store_website_email_template']){const {data,error}=await db.from(table).select('*');console.log(table, error?.message??data);}const {data}=await db.from('store_invitations').select('email_payload').order('created_at',{ascending:false}).limit(3);console.log('Previous mail headers:',data?.map(x=>({from:x.email_payload?.from,reply_to:x.email_payload?.reply_to})));try{console.log('Printful webhook:',await new PrintfulClient().request('/webhooks'));}catch(e){console.log('Webhook inspection unavailable:',e instanceof Error?e.message:'error');}}
main();
