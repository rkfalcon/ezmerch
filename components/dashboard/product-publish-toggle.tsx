"use client";

import { useState } from "react";
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
    const result = await toggleProductPublished(productId, !isPublished);
    if (!result.error) {
      setIsPublished(!isPublished);
    }
    setPending(false);
  }

  return (
    <button onClick={handleToggle} disabled={pending} className="cursor-pointer">
      <Badge variant={isPublished ? "default" : "secondary"}>
        {pending ? "..." : isPublished ? "Published" : "Draft"}
      </Badge>
    </button>
  );
}
