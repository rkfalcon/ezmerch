import { requireStoreOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function StoreOverviewPage() {
  const user = await requireStoreOwner();
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("id", user.storeId)
    .single();

  // Fetch order stats
  const { data: orders } = await supabase
    .from("orders")
    .select("subtotal_cents, platform_fee_cents, status")
    .eq("store_id", user.storeId);

  const totalOrders = orders?.length ?? 0;
  const pendingOrders = orders?.filter((o) => ["paid", "fulfilling"].includes(o.status)).length ?? 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + (o.subtotal_cents - o.platform_fee_cents), 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{store?.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            ezmerch.store/{store?.slug}
          </p>
        </div>
        {store?.stripe_account_id ? (
          <Badge variant="default">Stripe Connected</Badge>
        ) : (
          <Link href="/dashboard/store/connect">
            <Button variant="outline" size="sm">Connect Stripe</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Orders</CardDescription>
            <CardTitle className="text-3xl">{totalOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Orders</CardDescription>
            <CardTitle className="text-3xl">{pendingOrders}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your Earnings</CardDescription>
            <CardTitle className="text-3xl">
              ${(totalRevenue / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">60% of product subtotals</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/dashboard/store/products">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Products</CardTitle>
              <CardDescription>Manage your store&apos;s products</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/store/orders">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Orders</CardTitle>
              <CardDescription>View and manage orders</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/store/settings">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
              <CardDescription>Update store branding and shipping</CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/dashboard/store/connect">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base">Stripe Connect</CardTitle>
              <CardDescription>Manage your payout settings</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
