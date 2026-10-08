import { siteOrigin } from "@/lib/site";
import { requireAdmin } from "@/lib/auth";
import { invitationTemplate } from "@/lib/invitations/server";
import { developerEmailTemplate } from "@/lib/sharing/server";
import { StoreInvitation } from "@/components/dashboard/store-invitation";
import { DeveloperEmailEditor } from "@/components/dashboard/developer-email-editor";
export default async function Page() {
  await requireAdmin();
  const [invitation, developer] = await Promise.all([
    invitationTemplate(),
    developerEmailTemplate(),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <h1 className="text-2xl font-bold">Emails</h1>
      <p className="text-muted-foreground">
        Edit the messages sent from VeryMerch. Open a section to update its
        subject and body and preview the email.
      </p>
      <details className="rounded-xl border p-5">
        <summary className="cursor-pointer font-semibold">
          Store invitation emails
        </summary>
        <div className="pt-5">
          <StoreInvitation
            defaultsOnly
            template={invitation}
            origin={
              siteOrigin
            }
            store={{
              name: "Your Store",
              slug: "your-store",
              logo_url: null,
              products: [
                { title: "Your branded T-shirt", image: null },
                { title: "Your branded hoodie", image: null },
              ],
            }}
          />
        </div>
      </details>
      <details className="rounded-xl border p-5">
        <summary className="cursor-pointer font-semibold">
          Website instructions emails
        </summary>
        <DeveloperEmailEditor template={developer} />
      </details>
    </div>
  );
}
