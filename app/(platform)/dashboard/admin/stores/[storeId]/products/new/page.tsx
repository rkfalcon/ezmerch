import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/dashboard/product-form";

export default async function AdminNewProductPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  await requireAdmin();
  const { storeId } = await params;
  const supabase = await createClient();

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("id", storeId)
    .single();

  if (!store) notFound();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add Product to {store.name}</h1>
        <p className="text-muted-foreground">
          Create a new print-on-demand product
        </p>
      </div>
      <ProductForm
        storeId={storeId}
        returnPath={`/dashboard/admin/stores/${storeId}/products`}
      />
    </div>
  );
}
