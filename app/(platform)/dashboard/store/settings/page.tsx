import { requireStoreOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StoreSettingsForm } from "@/components/dashboard/store-settings-form";

export default async function StoreSettingsPage() {
  const user = await requireStoreOwner();
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", user.storeId)
    .single();

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
      <StoreSettingsForm store={store} />
    </div>
  );
}
