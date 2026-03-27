import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { StoreForm } from "@/components/dashboard/store-form";
import { ClaimLinkCard } from "@/components/dashboard/claim-link-card";

export default async function EditStorePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requireAdmin();
  const { storeId } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", storeId)
    .single();

  if (!store) {
    notFound();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Edit Store: {store.name}</h1>
        <p className="text-muted-foreground font-mono text-sm">
          /{store.slug}
        </p>
      </div>

      {!store.claimed && store.claim_token && (
        <div className="mb-6">
          <ClaimLinkCard storeId={store.id} claimToken={store.claim_token} />
        </div>
      )}

      <StoreForm store={store} />
    </div>
  );
}
