import { StoreShareBar } from "@/components/dashboard/store-share-bar";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectActiveStore } from "@/app/actions/active-store";
import { getUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserWithRole();

  if (!user) {
    redirect("/login");
  }

  const { data: ownedStores } = user.isStoreOwner
    ? await createAdminClient()
        .from("stores")
        .select("id,name,slug")
        .eq("owner_id", user.id)
        .order("created_at")
    : { data: [] };

  const activeStore =
    ownedStores?.find((store) => store.id === user.storeId) ?? ownedStores?.[0];

  return (
    <SidebarProvider>
      <DashboardSidebar user={user} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <span className="text-sm font-medium text-muted-foreground">
            VeryMerch
          </span>
          {(ownedStores?.length ?? 0) > 1 && (
            <form
              action={selectActiveStore}
              className="ml-auto flex items-center gap-2"
            >
              <label htmlFor="active-store" className="sr-only">
                Active store
              </label>
              <select
                id="active-store"
                name="storeId"
                defaultValue={user.storeId ?? undefined}
                className="max-w-48 rounded border p-1 text-sm"
              >
                {ownedStores!.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded border px-2 py-1 text-sm"
                type="submit"
              >
                Switch store
              </button>
            </form>
          )}
        </header>
        <main className="flex-1 p-6">
          {activeStore && (
            <div className="mb-6">
              <StoreShareBar store={activeStore} />
            </div>
          )}
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
