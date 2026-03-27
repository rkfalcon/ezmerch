import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RefundButton } from "@/components/dashboard/refund-button";
import { RetryFulfillmentButton } from "@/components/dashboard/retry-fulfillment-button";

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

export default async function AdminOrdersPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("*, stores(name, slug)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">All Orders</h1>
        <p className="text-muted-foreground">Manage orders across all stores</p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Store</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Platform Fee</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders && orders.length > 0 ? (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {(order.stores as { name: string })?.name}
                    </span>
                  </TableCell>
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
                  <TableCell>
                    <div className="flex gap-1">
                      {order.status !== "refunded" &&
                        order.stripe_payment_intent_id && (
                          <RefundButton orderId={order.id} />
                        )}
                      {order.status === "fulfillment_failed" && (
                        <RetryFulfillmentButton orderId={order.id} />
                      )}
                    </div>
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
    </div>
  );
}
