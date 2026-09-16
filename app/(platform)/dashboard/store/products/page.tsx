import { requireStoreOwner } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductPublishToggle } from "@/components/dashboard/product-publish-toggle";
import { ProductColorPreview } from "@/components/dashboard/product-color-preview";

export default async function StoreOwnerProductsPage() {
  const user = await requireStoreOwner();
  const supabase = createAdminClient();
  // Resolve current ownership from the database, including sessions whose role
  // claim has no store ID. Never trust a client-provided store ID here.
  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id")
    .eq("owner_id", user.id);
  if (storesError) throw storesError;

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .in(
      "store_id",
      (stores ?? []).map((store) => store.id),
    )
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Products</h1>
          <p className="text-muted-foreground">
            Manage your store&apos;s products
          </p>
        </div>
        <Link href="/dashboard/store/products/new">
          <Button>Add Product</Button>
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
                    <TableCell className="font-medium">
                      <ProductColorPreview
                        product={{
                          id: product.id,
                          title: product.title,
                          thumbnail_url: product.thumbnail_url,
                        }}
                      />
                    </TableCell>
                    <TableCell>{variantCount} variants</TableCell>
                    <TableCell>
                      <ProductPublishToggle
                        productId={product.id}
                        published={product.published}
                        globalActive={product.global_active}
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(product.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-8 text-muted-foreground"
                >
                  No products yet. Add your first product to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
