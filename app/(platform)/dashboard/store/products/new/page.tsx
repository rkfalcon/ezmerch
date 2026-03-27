import { requireStoreOwner } from "@/lib/auth";
import { ProductForm } from "@/components/dashboard/product-form";

export default async function StoreOwnerNewProductPage() {
  const user = await requireStoreOwner();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add Product</h1>
        <p className="text-muted-foreground">
          Create a new print-on-demand product for your store
        </p>
      </div>
      <ProductForm
        storeId={user.storeId!}
        returnPath="/dashboard/store/products"
      />
    </div>
  );
}
