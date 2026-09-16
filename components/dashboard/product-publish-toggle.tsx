"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
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
    <button
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
      <Badge
        variant="outline"
        className={
          globalActive && isPublished
            ? "border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-200"
            : "border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-200"
        }
      >
        {!globalActive
          ? "Disabled globally"
          : pending
            ? "..."
            : isPublished
              ? "Published"
              : "Draft"}
      </Badge>
    </button>
  );
}
