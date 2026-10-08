import { cookies } from "next/headers";
export async function activeStoreId(stores: { id: string }[]) {
  const selected = (await cookies()).get("ezmerch_active_store")?.value;
  return stores.find((s) => s.id === selected)?.id ?? stores[0]?.id ?? null;
}
