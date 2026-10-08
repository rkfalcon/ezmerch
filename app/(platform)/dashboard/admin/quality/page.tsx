import {requireAdmin} from '@/lib/auth';
import {createAdminClient} from '@/lib/supabase/admin';
import {loadQualityPolicy} from '@/lib/lineup/quality-policy-store';
import {QualitySettings} from '@/components/dashboard/quality-settings';
export default async function QualityPage(){
 await requireAdmin();
 const policy=await loadQualityPolicy(createAdminClient());
 return <div className="max-w-5xl space-y-4"><h1 className="text-2xl font-semibold">Artwork quality settings</h1><QualitySettings initial={policy}/></div>;
}
