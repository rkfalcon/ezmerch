import type {createAdminClient} from '../supabase/admin';
import {validateQualityValues,defaultQualityValues,type QualityPolicy} from './quality-policy';
export async function loadQualityPolicy(db:ReturnType<typeof createAdminClient>):Promise<QualityPolicy>{
 const {data,error}=await db.from('artwork_quality_settings').select('revision,values').eq('id',1).single();
 if(error||!data)throw Error('Artwork quality settings could not be loaded. Processing will retry.');
 return {revision:data.revision,values:validateQualityValues({edgeOutlierPercent:defaultQualityValues.edgeOutlierPercent,edgeOutlierVisiblePercent:defaultQualityValues.edgeOutlierVisiblePercent,edgeOutlierClusterPixels:defaultQualityValues.edgeOutlierClusterPixels,...data.values})};
}
