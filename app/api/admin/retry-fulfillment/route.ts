import { NextResponse } from "next/server";
import { getUserWithRole } from "@/lib/auth";
import { retryFulfillment } from "@/lib/orders";

export async function POST(request: Request) {
  const user = await getUserWithRole();
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await request.json();

  try {
    await retryFulfillment(orderId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Retry failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
