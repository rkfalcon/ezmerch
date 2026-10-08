import { requireAdmin } from "@/lib/auth";
import { EarningsReport } from "@/components/dashboard/earnings-report";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const query = await searchParams;
  return (
    <EarningsReport
      admin
      page={Math.max(1, Math.floor(Number(query.page) || 1))}
    />
  );
}
