import { onboardingStore } from "@/lib/onboarding/store";
import { revalidatePath } from "next/cache";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.acceptEarningsPolicy !== true)
      throw new Error("Accept the earnings policy before starting sales.");
    const { store, db } = await onboardingStore();
    if (!store?.onboarding_started_at)
      throw new Error("Create your store first.");
    const { count, error } = await db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("store_id", store.id)
      .eq("published", true)
      .eq("global_active", true);
    if (error) throw error;
    if (!count)
      throw new Error(
        "Your products are still being prepared. You can start selling as soon as the first product is ready.",
      );
    const { error: saveError } = await db
      .from("stores")
      .update({
        selling_enabled: true,
        earnings_policy_accepted_at: new Date().toISOString(),
        earnings_policy_version: "owner-margin-70-30-30days-v1",
      })
      .eq("id", store.id);
    if (saveError) throw saveError;
    revalidatePath("/");
    revalidatePath(`/${store.slug}`, "layout");
    revalidatePath("/dashboard", "layout");
    return Response.json({ success: true });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not launch the store.",
      },
      { status: 400 },
    );
  }
}
