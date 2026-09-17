export function jobStatus(status: string, error: string | null) {
  if (status === "completed")
    return { label: "Generated", message: null, failed: false };
  if (status === "failed")
    return { label: "Needs attention", message: error, failed: true };
  if (error?.startsWith("Printful 429:"))
    return {
      label: "Waiting for Printful",
      message:
        "Printful is temporarily limiting requests. Generation will resume automatically; no need to upload again.",
      failed: false,
    };
  if (error === "No available variants for this product")
    return {
      label: "Waiting for stock",
      message:
        "Printful currently has no in-stock variants. We’ll check again automatically. Other products will continue generating.",
      failed: false,
    };
  return {
    label: status === "running" ? "Generating" : "Queued",
    message: error
      ? "A temporary problem delayed this product. We’ll retry automatically."
      : null,
    failed: false,
  };
}
