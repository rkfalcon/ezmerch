import { LineupLogo } from "@/components/dashboard/lineup-logo";
import { StoreBannerForm } from "@/components/dashboard/store-banner-form";
import { requireStoreOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";

export default async function StoreSettingsPage() {
  const user = await requireStoreOwner();
  const supabase = await createClient();

  let query = supabase.from("stores").select("*").eq("owner_id", user.id);
  if (user.storeId) query = query.eq("id", user.storeId);
  const { data: store } = await query.order("created_at").limit(1).single();

  if (!store) {
    return <div>Store not found</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Store Settings</h1>
        <p className="text-muted-foreground">
          Update your store&apos;s branding and shipping
        </p>
      </div>
      <LineupLogo storeId={store.id} logoUrl={store.logo_url} />
      <StoreBannerForm store={store} />
      <StoreSettingsForm store={store} />
    </div>
  );
}
