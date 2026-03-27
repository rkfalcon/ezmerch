import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminOverviewPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: stores } = await supabase.from("stores").select("id, claimed");
  const { data: orders } = await supabase
    .from("orders")
    .select("total_cents, platform_fee_cents, subtotal_cents, status");

  const totalStores = stores?.length ?? 0;
  const claimedStores = stores?.filter((s) => s.claimed).length ?? 0;
  const totalOrders = orders?.length ?? 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + o.total_cents, 0) ?? 0;
  const platformFees = orders?.reduce((sum, o) => sum + o.platform_fee_cents, 0) ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">Platform overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Stores</CardDescription>
            <CardTitle className="text-3xl">{totalStores}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {claimedStores} claimed, {totalStores - claimedStores} unclaimed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-3xl">{totalOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Revenue</CardDescription>
            <CardTitle className="text-3xl">
              ${(totalRevenue / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Platform Fees</CardDescription>
            <CardTitle className="text-3xl">
              ${(platformFees / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              40% of claimed store subtotals + 100% of unclaimed
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
