import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { ClaimStoreCard } from "@/components/claim/claim-store-card";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const user = await getUser();

  // Look up the store by claim token
  const { data: store } = await supabase
    .from("stores")
    .select("id, name, slug, brand_colors, claimed, claim_token_expires_at")
    .eq("claim_token", token)
    .eq("claimed", false)
    .single();

  // Check if token is expired
  const isExpired =
    store?.claim_token_expires_at &&
    new Date(store.claim_token_expires_at) < new Date();

  if (!store || isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-destructive">
            Invalid or Expired Link
          </h1>
          <p className="mt-2 text-muted-foreground">
            This claim link is no longer valid. It may have expired or the store
            has already been claimed. Please contact the admin for a new link.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <ClaimStoreCard
        store={store}
        token={token}
        isAuthenticated={!!user}
      />
    </div>
  );
}
