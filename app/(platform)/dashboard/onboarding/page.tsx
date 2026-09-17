import { redirect } from "next/navigation";
import { onboardingStore } from "@/lib/onboarding/store";
import { requireAuth } from "@/lib/auth";
import { StoreOnboarding } from "@/components/dashboard/store-onboarding";
export default async function OnboardingPage() {
  await requireAuth();
  const { store } = await onboardingStore();
  if (store && !store.onboarding_started_at)
    redirect("/dashboard/store/settings");
  return <StoreOnboarding />;
}
