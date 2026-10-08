import { createAdminClient } from './supabase/admin';
export async function fulfillmentConnection() {
  if(process.env.PRINTFUL_CONNECTION_SWITCH !== 'true') return {store_id:process.env.PRINTFUL_STORE_ID!,paused:false};
  const {data,error}=await createAdminClient().from('fulfillment_connection').select('store_id,paused').eq('id',true).single();
  if(error||!data)throw new Error('Fulfillment configuration unavailable');
  return data;
}
export async function printfulCredentials(storeId?:string) {
  const selected=storeId ?? (await fulfillmentConnection()).store_id;
  const prefix=selected===process.env.PRINTFUL_STORE_ID?'PRINTFUL':selected===process.env.PRINTFUL_NEXT_STORE_ID?'PRINTFUL_NEXT':null;
  const token=prefix ? process.env[`${prefix}_API_TOKEN`] : null;
  if(!token && process.env.PRINTFUL_CONNECTION_SWITCH !== 'true') return {token:'',storeId:selected};
  if(!token)throw new Error('Fulfillment account unavailable');
  return {token,storeId:selected};
}
