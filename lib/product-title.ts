// Keep catalog/manufacturer details in stored titles for administrators.
export function productTitle(title: string): string {
  return title.split("|", 1)[0].trim();
}
