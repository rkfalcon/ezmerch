import { requireStoreOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { developerEmailTemplate } from "@/lib/sharing/server";
import { StoreSharing } from "@/components/dashboard/store-sharing";
export default async function Page() {
  const user = await requireStoreOwner();
  const db = createAdminClient();
  const { data: store, error } = await db
    .from("stores")
    .select("id,name,slug")
    .eq("owner_id", user.id)
    .eq("id", user.storeId)
    .maybeSingle();
  if (error) throw error;
  if (!store)
    return <p>Create or claim your store first to get your sharing link.</p>;
  const [template, { data: recent, error: emailError }] = await Promise.all([
    developerEmailTemplate(),
    db
      .from("store_website_emails")
      .select("id,recipient_email,email_status,created_at,last_error")
      .eq("store_id", store.id)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  if (emailError) throw emailError;
  return (
    <StoreSharing
      key={store.id}
      store={store}
      template={template}
      recent={recent ?? []}
    />
  );
}
