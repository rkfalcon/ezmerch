import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="text-2xl">Order Confirmed!</CardTitle>
          <CardDescription>
            Thank you for your purchase. Your order is being processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You&apos;ll receive a confirmation email with your order details and
            tracking information once your items ship.
          </p>
          <p className="text-xs text-muted-foreground">
            Print-on-demand items are made to order and typically ship within
            2-7 business days.
          </p>
          <Link href={`/${storeSlug}`}>
            <Button variant="outline" className="mt-4">
              Continue Shopping
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
