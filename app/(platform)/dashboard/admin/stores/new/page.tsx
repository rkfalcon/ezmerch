import { requireAdmin } from "@/lib/auth";
import { StoreForm } from "@/components/dashboard/store-form";

export default async function NewStorePage() {
  await requireAdmin();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Store</h1>
        <p className="text-muted-foreground">
          Set up a new storefront for a store owner
        </p>
      </div>
      <StoreForm />
    </div>
  );
}
