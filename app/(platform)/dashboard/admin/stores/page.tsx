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

  // Fetch display names for claimed stores
  const ownerIds = stores
    ?.filter((s) => s.owner_id)
    .map((s) => s.owner_id) ?? [];

  const ownerProfiles: Record<string, string> = {};
  if (ownerIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", ownerIds);
    profiles?.forEach((p) => {
      if (p.display_name) ownerProfiles[p.id] = p.display_name;
    });
  }

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
              <TableHead>Claimed By</TableHead>
              <TableHead>Claimed At</TableHead>
              <TableHead>Shipping</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stores && stores.length > 0 ? (
              stores.map((store) => {
                const ownerName = store.owner_id ? ownerProfiles[store.owner_id] : null;
                return (
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
                    <TableCell>
                      {store.claimed && ownerName ? (
                        <span className="text-sm">{ownerName}</span>
                      ) : store.claimed && store.owner_id ? (
                        <span className="text-xs text-muted-foreground font-mono">
                          {store.owner_id.slice(0, 8)}...
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {store.claimed_at ? (
                        <span className="text-sm">
                          {new Date(store.claimed_at).toLocaleDateString()}{" "}
                          <span className="text-muted-foreground">
                            {new Date(store.claimed_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
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
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
