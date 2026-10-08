import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
const labels: Record<string, string> = {
  pending: "Awaiting Stripe setup",
  eligible: "Eligible · awaiting transfer",
  transferred: "Transferred to Stripe",
  expired: "Deadline passed · VeryMerch retained",
  refunded: "Refunded",
  disputed: "Disputed · on hold",
  no_margin: "No merchandise margin",
};
export async function EarningsReport({
  admin = false,
  page = 1,
}: {
  admin?: boolean;
  page?: number;
}) {
  const db = await createClient();
  const offset = (page - 1) * 50;
  const { data, error } = await db
    .from("owner_earnings")
    .select("*, stores(name,slug), orders(stripe_payment_intent_id)", {
      count: "exact",
    })
    .order("sold_at", { ascending: false })
    .range(offset, offset + 50);
  if (error) throw new Error("Could not load earnings");
  const rows = data?.slice(0, 50) ?? [];
  const path = admin
    ? "/dashboard/admin/earnings"
    : "/dashboard/store/earnings";
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">
        {admin ? "Owner earnings" : "Your earnings"}
      </h1>
      <p className="max-w-3xl text-sm text-muted-foreground">
        Owners receive 70% of merchandise margin after product and printing
        costs. Complete Stripe verification within 30 days of each sale to
        collect its share. After that deadline, VeryMerch retains that sale’s
        margin. Verified owners qualify for future sales and earlier sales still
        within their 30-day windows. Shipping and tax are separate.
      </p>
      <p className="text-sm">
        Transfers shown here go to a Stripe balance. Bank payouts follow
        Stripe’s schedule. This ledger covers sales under the new 30-day policy;
        older orders remain in Orders.
      </p>
      {!admin && (
        <Link
          className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
          href="/dashboard/store/connect"
        >
          Set up or check payouts
        </Link>
      )}
      {!rows.length ? (
        <p>No earnings recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted">
              <tr>
                {[
                  "Store / order",
                  "Sale date (UTC)",
                  "Setup deadline (UTC)",
                  "Original share",
                  "Current share",
                  "Status",
                  "Transfer",
                ].map((h) => (
                  <th key={h} className="p-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.order_id} className="border-t align-top">
                  <td className="p-3">
                    <Link className="underline" href={`/${row.stores?.slug}`}>
                      {row.stores?.name}
                    </Link>
                    <p className="mt-1 font-mono text-xs">{row.order_id}</p>
                    {admin && row.orders?.stripe_payment_intent_id && (
                      <a
                        className="underline"
                        href={`https://dashboard.stripe.com/payments/${row.orders.stripe_payment_intent_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View payment in Stripe
                      </a>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {new Date(row.sold_at)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {new Date(row.deadline_at)
                      .toISOString()
                      .slice(0, 16)
                      .replace("T", " ")}
                  </td>
                  <td className="p-3">
                    ${(row.original_owner_cents / 100).toFixed(2)}
                  </td>
                  <td className="p-3">${(row.owner_cents / 100).toFixed(2)}</td>
                  <td className="p-3">
                    {labels[row.status] ?? row.status}
                    {row.last_error && (
                      <p className="mt-1 text-amber-700">
                        {admin
                          ? row.last_error
                          : "Processing needs attention. Your recorded eligibility is preserved."}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    $
                    {(
                      (row.transferred_cents - row.reversed_cents) /
                      100
                    ).toFixed(2)}
                    {row.stripe_transfer_id && (
                      <p className="mt-1 text-xs break-all">
                        {row.stripe_transfer_id}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <nav className="flex gap-4" aria-label="Earnings pages">
        {page > 1 && (
          <Link className="underline" href={`${path}?page=${page - 1}`}>
            Previous
          </Link>
        )}
        {(data?.length ?? 0) > 50 && (
          <Link className="underline" href={`${path}?page=${page + 1}`}>
            Next
          </Link>
        )}
      </nav>
    </div>
  );
}
