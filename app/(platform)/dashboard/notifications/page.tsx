import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { markNotificationRead } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";

export default async function NotificationsPage() {
  const user = await requireAuth();
  const db = await createClient();
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-2xl font-bold">Notifications</h1>
      {error ? (
        <p role="alert">
          Notifications are unavailable. Complete the database setup first.
        </p>
      ) : !data?.length ? (
        <p className="text-muted-foreground">
          You’re all caught up. Product and order updates will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {data.map((n) => (
            <li
              key={n.id}
              className={`rounded-lg border p-4 ${n.read_at ? "" : "bg-muted/40"}`}
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{n.title}</h2>
                  <p className="text-sm mt-1">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={n.href} className="text-sm underline">
                    View details
                  </Link>
                  {!n.read_at && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={n.id} />
                      <Button size="sm" variant="outline">
                        Mark read
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
