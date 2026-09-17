import { isReservedSlug } from "../reserved-slugs";

export function storeSlugBase(name: string) {
  let base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/, "");
  if (!base) base = "my-store";
  if (base.length < 2 || isReservedSlug(base)) base += "-store";
  return base;
}

// The database's unique slug constraint resolves concurrent signups safely.
export async function createWithStoreSlug(
  name: string,
  create: (
    slug: string,
  ) => Promise<{
    data: string | null;
    error: { code?: string; message: string } | null;
  }>,
) {
  const base = storeSlugBase(name);
  for (let attempt = 1; attempt <= 100; attempt++) {
    const { data, error } = await create(
      attempt === 1 ? base : `${base}-${attempt}`,
    );
    if (!error && data) return data;
    if (error?.code !== "23505")
      throw new Error(error?.message ?? "Could not create your store.");
  }
  throw new Error(
    "That store name is already in use. Please choose a more specific name.",
  );
}
