import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function AdminStoresPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stores</h1>
          <p className="text-muted-foreground">Manage all storefronts</p>
        </div>
        <Link href="/dashboard/admin/stores/new">
          <Button>Create Store</Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Shipping</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores && stores.length > 0 ? (
              stores.map((store) => (
                <TableRow key={store.id}>
                  <TableCell className="font-medium">{store.name}</TableCell>
                  <TableCell className="font-mono text-sm">
                    /{store.slug}
                  </TableCell>
                  <TableCell>
                    {store.claimed ? (
                      <Badge variant="default">Claimed</Badge>
                    ) : (
                      <Badge variant="secondary">Unclaimed</Badge>
                    )}
                    {store.stripe_account_id && (
                      <Badge variant="outline" className="ml-1">
                        Stripe
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">
                    {store.shipping_policy?.replace("_", " ")}
                  </TableCell>
                  <TableCell>
                    {new Date(store.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/dashboard/admin/stores/${store.id}`}>
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No stores yet. Create your first store to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
