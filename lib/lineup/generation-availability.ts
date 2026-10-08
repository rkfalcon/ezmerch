// Availability holds stay queued for automatic retry, but are not preparing previews.
export function generationUnavailable(error: string | null | undefined): boolean {
  return error === "No available variants for this product" ||
    error === "This Printful product has been discontinued";
}
