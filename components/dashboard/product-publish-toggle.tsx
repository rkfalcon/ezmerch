"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleProductPublished } from "@/app/actions/products";

export function ProductPublishToggle({
  productId,
  published,
  globalActive = true,
}: {
  productId: string;
  published: boolean;
  globalActive?: boolean;
}) {
  const router = useRouter();
  const isPublished = published;
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        const result = await toggleProductPublished(productId, !isPublished);
        if (result.error) toast.error(result.error);
        else router.refresh();
      } catch {
        toast.error("Could not update product visibility");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Badge variant="outline">{!globalActive ? "Disabled globally" : isPublished ? "Published" : "Draft"}</Badge>
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={handleToggle}
      disabled={pending || !globalActive}
      aria-label={
        !globalActive
          ? "Disabled globally"
          : isPublished
            ? "Hide product"
            : "Publish product"
      }
      className="cursor-pointer"
    >
      {!globalActive ? "Disabled globally" : pending ? "Saving…" : isPublished ? "Hide product" : "Publish product"}
    </Button>
    </div>
  );
}
