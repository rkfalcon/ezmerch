"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { toggleProductPublished } from "@/app/actions/products";

export function ProductPublishToggle({
  productId,
  published,
}: {
  productId: string;
  published: boolean;
}) {
  const [isPublished, setIsPublished] = useState(published);
  const [pending, setPending] = useState(false);

  async function handleToggle() {
    setPending(true);
    try {
      const result = await toggleProductPublished(productId, !isPublished);
      if (result.error) toast.error(result.error);
      else setIsPublished(!isPublished);
    } catch {
      toast.error("Could not update product visibility");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={pending}
      aria-label={isPublished ? "Hide product" : "Publish product"}
      className="cursor-pointer"
    >
      <Badge variant={isPublished ? "default" : "secondary"}>
        {pending ? "..." : isPublished ? "Published" : "Draft"}
      </Badge>
    </button>
  );
}
