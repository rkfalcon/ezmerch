import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { StoreForm } from "@/components/dashboard/store-form";
import { ClaimLinkCard } from "@/components/dashboard/claim-link-card";
import { ProductPublishToggle } from "@/components/dashboard/product-publish-toggle";
import { RefundButton } from "@/components/dashboard/refund-button";

const statusColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  paid: "default",
  fulfilling: "default",
  fulfillment_failed: "destructive",
  shipped: "outline",
  delivered: "outline",
  failed: "destructive",
  refunded: "secondary",
};

export default async function AdminStoreDetailPage({
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

  if (!store) notFound();

  // Fetch products
  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  // Fetch orders
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });

  // Stats
  const totalOrders = orders?.length ?? 0;
  const pendingOrders = orders?.filter((o) => ["paid", "fulfilling"].includes(o.status)).length ?? 0;
  const totalRevenue = orders?.reduce((sum, o) => sum + o.total_cents, 0) ?? 0;
  const platformFees = orders?.reduce((sum, o) => sum + o.platform_fee_cents, 0) ?? 0;
  const ownerEarnings = orders?.reduce((sum, o) => sum + (o.subtotal_cents - o.platform_fee_cents), 0) ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <p className="text-muted-foreground font-mono text-sm">
            ezmerch.store/{store.slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {store.claimed ? (
            <Badge variant="default">Claimed</Badge>
          ) : (
            <Badge variant="secondary">Unclaimed</Badge>
          )}
          {store.stripe_account_id && (
            <Badge variant="outline">Stripe Connected</Badge>
          )}
          <Link href={`/${store.slug}`} target="_blank">
            <Button variant="outline" size="sm">View Storefront</Button>
          </Link>
        </div>
      </div>

      {!store.claimed && store.claim_token && (
        <div className="mb-6">
          <ClaimLinkCard storeId={store.id} claimToken={store.claim_token} />
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">Products ({products?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="orders">Orders ({totalOrders})</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Orders</CardDescription>
                <CardTitle className="text-3xl">{totalOrders}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Pending</CardDescription>
                <CardTitle className="text-3xl">{pendingOrders}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-3xl">${(totalRevenue / 100).toFixed(2)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Platform Fees</CardDescription>
                <CardTitle className="text-3xl">${(platformFees / 100).toFixed(2)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Owner earnings: ${(ownerEarnings / 100).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>

          {store.claimed && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Store Owner</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><span className="text-muted-foreground">Email:</span> {store.owner_email ?? "—"}</p>
                <p><span className="text-muted-foreground">Claimed:</span> {store.claimed_at ? new Date(store.claimed_at).toLocaleString() : "—"}</p>
                <p><span className="text-muted-foreground">Stripe:</span> {store.stripe_account_id ?? "Not connected"}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PRODUCTS TAB */}
        <TabsContent value="products" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Products</h2>
            <Link href={`/dashboard/admin/stores/${storeId}/products/new`}>
              <Button size="sm">Add Product</Button>
            </Link>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Variants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products && products.length > 0 ? (
                  products.map((product) => {
                    const variantCount = Array.isArray(product.variants)
                      ? product.variants.length
                      : 0;
                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-medium">{product.title}</TableCell>
                        <TableCell>{variantCount} variants</TableCell>
                        <TableCell>
                          <ProductPublishToggle
                            productId={product.id}
                            published={product.published}
                          />
                        </TableCell>
                        <TableCell>{new Date(product.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      No products yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ORDERS TAB */}
        <TabsContent value="orders" className="mt-6">
          <h2 className="text-lg font-semibold mb-4">Orders</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Platform Fee</TableHead>
                  <TableHead className="text-right">Owner Earnings</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders && orders.length > 0 ? (
                  orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{order.customer_email}</TableCell>
                      <TableCell>
                        <Badge variant={statusColors[order.status] ?? "secondary"}>
                          {order.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        ${(order.total_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${(order.platform_fee_cents / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${((order.subtotal_cents - order.platform_fee_cents) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {order.status !== "refunded" && order.stripe_payment_intent_id && (
                          <RefundButton orderId={order.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No orders yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="mt-6">
          <StoreForm store={store} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
