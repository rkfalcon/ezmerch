import { productDisplayImage } from "@/lib/product-colors";
export type InvitationTemplate = { subject: string; body: string };
export type InvitationStore = {
  name: string;
  slug: string;
  logo_url: string | null;
  brand_colors?: { primary?: string; accent?: string };
  products: { title: string; image: string | null }[];
};
export const defaultInvitationTemplate: InvitationTemplate = {
  subject: "Russ created {store_name} for you on VeryMerch.com",
  body: "Hi there!\n\nRuss has created a new store for you on VeryMerch.com: {store_name}.\n\nYour storefront and products are ready for you to explore below. Create an account or sign in to accept your store, manage your products, and set up payouts.\n\nYour store: {store_url}\n\nWelcome aboard!\nRuss",
};
const placeholders = ["store_name", "store_url", "claim_url"];
export function validateInvitationTemplate(
  template: InvitationTemplate,
): string | null {
  if (
    !template.subject.trim() ||
    template.subject.length > 200 ||
    /[\r\n]/.test(template.subject)
  )
    return "Enter a subject of 1–200 characters on one line.";
  if (!template.body.trim() || template.body.length > 10000)
    return "Enter a message of 1–10,000 characters.";
  const unknown = [
    ...`${template.subject} ${template.body}`.matchAll(/\{([^{}]+)\}/g),
  ].find((m) => !placeholders.includes(m[1]));
  return unknown
    ? `Unknown placeholder: {${unknown[1]}}. Use {store_name}, {store_url}, or {claim_url}.`
    : null;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function imageUrl(value: string | null): string | null {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" ? escape(url.href) : null;
  } catch {
    return null;
  }
}
export function renderInvitation(
  template: InvitationTemplate,
  store: InvitationStore,
  origin: string,
  claimUrl: string,
) {
  const storeUrl = `${origin.replace(/\/$/, "")}/${encodeURIComponent(store.slug)}`;
  const values: Record<string, string> = {
    store_name: store.name,
    store_url: storeUrl,
    claim_url: claimUrl,
  };
  const fill = (value: string) =>
    value.replace(
      /\{(store_name|store_url|claim_url)\}/g,
      (_, key) => values[key],
    );
  const subject = fill(template.subject).replace(/[\r\n]/g, " ");
  const body = fill(template.body);
  const primary = /^#[0-9a-f]{6}$/i.test(store.brand_colors?.primary || "")
    ? store.brand_colors!.primary
    : "#18181b";
  const logo = imageUrl(store.logo_url);
  const tiles = store.products.map((p) => {
    const image = imageUrl(p.image);
    return `<td width="50%" valign="top" style="padding:8px"><div style="border:1px solid #e4e4e7;border-radius:12px;padding:12px;background:white">${image ? `<img src="${image}" alt="${escape(p.title)}" width="240" style="display:block;width:100%;max-width:240px;height:auto;margin:auto"/>` : '<p style="padding:32px 0;color:#71717a">Product preview is being prepared</p>'}<p style="font-size:14px;line-height:20px">${escape(p.title)}</p></div></td>`;
  });
  const rows = Array.from(
    { length: Math.ceil(tiles.length / 2) },
    (_, i) => `<tr>${tiles[i * 2]}${tiles[i * 2 + 1] || "<td></td>"}</tr>`,
  ).join("");
  const button = `<a href="${escape(claimUrl)}" style="display:inline-block;background:#18181b;color:#fff;padding:16px 24px;text-decoration:none;border-radius:8px;font-weight:bold">Create account &amp; claim your store</a>`;
  return {
    subject,
    text: `${body}\n\nClaim your store: ${claimUrl}\nAlready have an account? Sign in using the invited email address. This invitation expires in 7 days.\n\nProducts:\n${store.products.map((p) => p.title).join("\n")}`,
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><table role="presentation" width="100%" style="table-layout:fixed"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="width:100%;max-width:600px;table-layout:fixed;word-wrap:break-word;overflow-wrap:anywhere;background:white;border-radius:16px"><tr><td style="padding:32px"><p style="font-weight:bold">VeryMerch.com</p><div style="line-height:1.7;white-space:pre-wrap;word-break:break-word">${escape(body).replace(/\n/g, "<br/>")}</div><p>${button}</p><p style="font-size:13px;color:#52525b">Already have an account? Sign in with the email that received this invitation. Your invitation expires in 7 days.</p></td></tr><tr><td style="padding:24px;text-align:center;border-top:6px solid ${primary};background:#fafafa">${logo ? `<img src="${logo}" alt="${escape(store.name)} logo" width="80" style="max-height:100px;object-fit:contain"/>` : ""}<h1 style="font-size:26px">${escape(store.name)}</h1><a href="${escape(storeUrl)}" style="color:#18181b">Preview your storefront →</a></td></tr><tr><td style="padding:8px"><table role="presentation" width="100%" style="table-layout:fixed">${rows}</table></td></tr><tr><td style="padding:24px;text-align:center">${button}</td></tr></table></td></tr></table></body></html>`,
  };
}

export function toInvitationStore(
  store: Omit<InvitationStore, "products">,
  products: (Parameters<typeof productDisplayImage>[0] & { title: string })[],
): InvitationStore {
  return {
    ...store,
    products: products.map((p) => ({
      title: p.title,
      image: productDisplayImage(p),
    })),
  };
}
