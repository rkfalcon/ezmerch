import { getUserWithRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getUserWithRole();

  if (!user) {
    redirect("/login");
  }

  if (user.isAdmin) {
    redirect("/dashboard/admin/stores");
  }

  if (user.isStoreOwner) {
    redirect("/dashboard/store");
  }

  // Customer with no store — show a simple landing
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to EZMerch</h1>
        <p className="mt-2 text-muted-foreground">
          Your account is set up. Check back soon for updates.
        </p>
      </div>
    </div>
  );
}
