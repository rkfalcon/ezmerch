const RESERVED_SLUGS = new Set([
  "login",
  "signup",
  "dashboard",
  "api",
  "claim",
  "auth",
  "admin",
  "settings",
  "checkout",
  "cart",
  "account",
  "profile",
  "order",
  "orders",
  "products",
  "store",
  "stores",
  "about",
  "contact",
  "help",
  "support",
  "terms",
  "privacy",
  "favicon.ico",
  "_next",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

export function validateSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || slug.trim().length === 0) {
    return { valid: false, error: "Slug is required" };
  }

  const normalized = slug.toLowerCase().trim();

  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(normalized) && normalized.length > 1) {
    return {
      valid: false,
      error: "Slug must contain only lowercase letters, numbers, and hyphens",
    };
  }

  if (normalized.length < 2 || normalized.length > 50) {
    return {
      valid: false,
      error: "Slug must be between 2 and 50 characters",
    };
  }

  if (isReservedSlug(normalized)) {
    return {
      valid: false,
      error: `"${normalized}" is a reserved name and cannot be used as a store slug`,
    };
  }

  return { valid: true };
}
