export function onboardingDetails(name: unknown, website: unknown) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100)
    throw new Error("Enter a store name of 1–100 characters.");
  let websiteUrl: string | null = null;
  if (typeof website === "string" && website.trim()) {
    const raw = website.trim();
    let url: URL;
    try {
      url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    } catch {
      throw new Error("Enter a valid website address, or leave it blank.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".") ||
      url.username ||
      url.password ||
      url.href.length > 2000
    )
      throw new Error("Enter a valid website address, or leave it blank.");
    websiteUrl = url.href;
  }
  return { name: name.trim(), websiteUrl };
}
export function stripeReady(account: {
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  capabilities?: { transfers?: string };
}) {
  return (
    account.charges_enabled === true &&
    account.payouts_enabled === true &&
    account.capabilities?.transfers === "active"
  );
}
