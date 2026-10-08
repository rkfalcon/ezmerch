import { siteOrigin } from "@/lib/site";
export type SharingStore = { name: string; slug: string };
export type DeveloperTemplate = { subject: string; body: string };
export const defaultDeveloperTemplate: DeveloperTemplate = {
  subject: "Please add {store_name}’s VeryMerch store to our website",
  body: "Hi!\n\nPlease add a “Shop our merch” link to our website’s main menu or a prominent button on our home page. Our VeryMerch store is {store_name}:\n{store_url}\n\nChoose the instructions below that match our website. All links and HTML are ready to use. After publishing, please test the link on a phone and a computer.\n\n{instructions}\n\nThank you!",
};
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function storeSharingGuide(store: SharingStore) {
  const url = `${siteOrigin}/${encodeURIComponent(store.slug)}`;
  const label = "Shop our merch";
  const linkCode = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  const buttonCode = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 12px 20px; background-color: #18181b; color: #ffffff; border-radius: 8px; text-decoration: none; font-family: Arial, sans-serif; font-weight: bold;">${label}</a>`;
  const platforms = [
    {
      name: "WordPress",
      source: "https://wordpress.com/support/menus/add-links-to-a-menu/",
      steps: [
        "Sign in to your WordPress dashboard. Under Appearance, choose Editor if your theme has it. Open the header’s Navigation block and add a link.",
        "For a classic theme, choose Appearance → Menus instead, select your main menu, and open Custom Links.",
        `Paste ${url} as the destination and use “${label}” as the link text. Add the link to your menu.`,
        "Save the changes (or Save Menu), then visit your published website and test the link.",
      ],
    },
    {
      name: "Shopify",
      source:
        "https://help.shopify.com/en/manual/online-store/menus-and-links/editing-menus",
      steps: [
        "In your Shopify admin, open Content → Menus. Select the menu displayed in your website’s header, usually Main menu.",
        `Choose Add menu item and name it “${label}”.`,
        `Paste ${url} in the link field. Wait for the destination to appear in the dropdown, then select it.`,
        "Choose Add, then Save or Save menu. Open your storefront and test the link.",
      ],
    },
    {
      name: "Wix",
      source:
        "https://support.wix.com/en/article/wix-editor-adding-a-new-item-to-your-site-menu",
      steps: [
        "Open your site in the Wix Editor and select Pages & Menu.",
        "Choose Add Menu Item → Link, then select Web address.",
        `Paste ${url}, choose whether to open a new window, and select Done.`,
        `Name the menu item “${label}”. Select Done, publish your website, and test the link. Wix Studio labels may differ; look for the menu’s Add item → Link option.`,
      ],
    },
    {
      name: "Google Business Profile",
      source: "https://support.google.com/business/answer/7342169?hl=en",
      steps: [
        "Sign in to the Google account that manages your Business Profile and open the profile.",
        "Choose Posts → Add post → Update. Write a short announcement about your merchandise and optionally add a product photo.",
        `Add a button, choose an available label such as “Learn more”, and paste ${url} as its destination.`,
        "Select Post. Google reviews posts before they become visible; check the post status and test its button once live. Options vary by profile.",
        "Keep your existing website address in your profile. This post adds a separate way to reach your merch store; Google Business Profile does not accept HTML snippets.",
      ],
    },
    {
      name: "HTML / any website",
      source: null,
      steps: [
        "Open the page or template where you want the link. Use an HTML/code block, or ask your developer to edit the page source.",
        "Paste either the simple link or styled button below into the page body. Use the plain store URL in a menu or button builder that asks for a web address.",
        'Save and publish. Test the link on a phone and computer. Both examples open your VeryMerch store in a new tab; remove target="_blank" to use the current tab.',
      ],
    },
  ];
  const agentPrompt = `Add a link to my VeryMerch storefront on my existing website.

Store name: ${store.name}
Exact storefront URL: ${url}
Link text: ${label}

1. Inspect my website's platform and existing navigation. Add this external link to the main navigation and its mobile menu. If a merch link already exists, update it rather than creating a duplicate.
2. Match the website's existing styling and accessibility conventions. Use the exact URL above. Keep the existing website and checkout intact; this is a link to my separately hosted merch store.
3. Use the platform's menu/link editor for WordPress, Shopify, Wix, or another website builder. For a custom website, use its existing navigation component. If plain HTML is needed, use:
${linkCode}
4. Check the link on desktop and mobile, verify keyboard access, and confirm it opens the correct storefront.
5. Show me what changed and a preview. If you cannot access or edit my website, explain exactly where I should paste the link or code. Ask for any missing website access through the platform's secure sign-in flow, not by requesting passwords in chat.
6. Publish only when I authorize it, then verify the link on the live website.`;
  const postText = `Our merchandise is here! Explore the ${store.name} collection and find your favorites.`;
  const instructions = `STORE LINK\n${url}\n\nSUGGESTED LINK TEXT\n${label}\n\n${platforms.map((p) => `${p.name}\n${p.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}${p.source ? `\nOfficial help: ${p.source}` : ""}`).join("\n\n")}\n\nAI AGENT / LLM INSTRUCTIONS\nCopy this prompt into your website agent:\n${agentPrompt}\n\nSIMPLE HTML LINK\n${linkCode}\n\nHTML BUTTON\n${buttonCode}\n\nSUGGESTED GOOGLE POST\n${postText}\nButton link: ${url}`;
  return {
    url,
    label,
    linkCode,
    buttonCode,
    platforms,
    instructions,
    postText,
    agentPrompt,
  };
}
export function validateDeveloperTemplate(
  template: DeveloperTemplate,
): string | null {
  if (
    typeof template?.subject !== "string" ||
    !template.subject.trim() ||
    template.subject.length > 200 ||
    /[\r\n]/.test(template.subject)
  )
    return "Enter a subject of 1–200 characters on one line.";
  if (
    typeof template.body !== "string" ||
    !template.body.trim() ||
    template.body.length > 15000
  )
    return "Enter a message of 1–15,000 characters.";
  const tokens = [
    ...`${template.subject} ${template.body}`.matchAll(/\{([a-z_]+)\}/gi),
  ];
  if (
    tokens.some(
      (m) =>
        ![
          "store_name",
          "store_url",
          "instructions",
          "html_link",
          "html_button",
        ].includes(m[1]),
    )
  )
    return "Unknown placeholder. Use {store_name}, {store_url}, {instructions}, {html_link}, or {html_button}.";
  if (/\{(instructions|html_link|html_button)\}/.test(template.subject))
    return "Use only {store_name} or {store_url} in the subject.";
  return null;
}
export function renderDeveloperEmail(
  template: DeveloperTemplate,
  store: SharingStore,
) {
  const guide = storeSharingGuide(store);
  const values: Record<string, string> = {
    store_name: store.name,
    store_url: guide.url,
    instructions: guide.instructions,
    html_link: guide.linkCode,
    html_button: guide.buttonCode,
  };
  const fill = (value: string) =>
    value.replace(
      /\{(store_name|store_url|instructions|html_link|html_button)\}/g,
      (_, key) => values[key],
    );
  const subject = fill(template.subject).replace(/[\r\n]/g, " ");
  const text =
    fill(template.body) +
    (template.body.includes("{instructions}")
      ? ""
      : `\n\n${guide.instructions}`);
  return {
    subject,
    text,
    html: `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b"><table role="presentation" width="100%" style="table-layout:fixed"><tr><td style="padding:20px 12px"><div style="max-width:680px;margin:auto;background:white;padding:24px;border-radius:12px;overflow-wrap:anywhere;word-break:break-word"><p style="font-weight:bold">VeryMerch.com</p><h1 style="font-size:22px">Add your store to your website</h1><p><a href="${escapeHtml(guide.url)}">${escapeHtml(store.name)}</a></p><div style="white-space:pre-wrap;line-height:1.6;font-size:14px">${escapeHtml(text)}</div></div></td></tr></table></body></html>`,
  };
}
