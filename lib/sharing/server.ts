import { createAdminClient } from "@/lib/supabase/admin";
import { defaultDeveloperTemplate } from "./guide";
export async function developerEmailTemplate() {
  const { data, error } = await createAdminClient()
    .from("store_website_email_template")
    .select("subject,body")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? defaultDeveloperTemplate;
}
