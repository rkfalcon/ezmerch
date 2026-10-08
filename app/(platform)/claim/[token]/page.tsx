import { createAdminClient } from "@/lib/supabase/admin";
import { hashInvitationToken } from "@/lib/invitations/server";
export const dynamic = "force-dynamic";
export const metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
import { getUser } from "@/lib/auth";
import { ClaimStoreCard } from "@/components/claim/claim-store-card";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();
  const user = await getUser();
  const { data: invitation } = await supabase
    .from("store_invitations")
    .select("store_id,expires_at")
    .eq("token_hash", hashInvitationToken(token))
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const { data: store } = invitation
    ? await supabase
        .from("stores")
        .select("id,name,slug,brand_colors")
        .eq("id", invitation.store_id)
        .eq("claimed", false)
        .maybeSingle()
    : { data: null };
  if (!store || !invitation) {
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
        email={user?.email}
      />
    </div>
  );
}
