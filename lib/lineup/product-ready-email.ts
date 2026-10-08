const escapeHtml = (text: string) => text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function productReadyEmail(input: {
  storeName: string; storeSlug: string; productTitle: string; imageUrl: string;
  dashboardPath: string; origin: string; published: boolean;
}) {
  const image = new URL(input.imageUrl);
  if (image.protocol !== 'https:') throw new Error('Product preview must use HTTPS');
  if (!input.dashboardPath.startsWith('/dashboard/') || input.dashboardPath.startsWith('//')) throw new Error('Invalid dashboard link');
  const storeUrl = new URL(`/${encodeURIComponent(input.storeSlug)}`, input.origin).href;
  const dashboardUrl = new URL(input.dashboardPath, input.origin).href;
  const title = input.productTitle.split(' | ')[0];
  const subject = `New for ${input.storeName}: ${title}`;
  const message = `${title} has been prepared with your ${input.storeName} logo and has variants available for U.S. delivery.`;
  const action = input.published ? 'View your products' : 'Review and enable sales';
  const instructions = input.published
    ? 'This product is already enabled in your store. You can manage it in your dashboard.'
    : 'Your new product is saved as a draft. Open your Products dashboard and find this product. Before publishing, click Edit price to set your selling price, review your estimated earnings, and save the price. Then click Publish product to make it available for purchase.';
  const progress = 'Additional colors may still be processing. Your dashboard shows which colors are ready.';
  return {
    subject,
    text: `${message}\n\n${instructions}\n\n${action}: ${dashboardUrl}\n\nYour storefront: ${storeUrl}\n\nProduct preview: ${image.href}\n\n${progress}\n\nVeryMerch`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;color:#222;line-height:1.6"><h1 style="font-size:24px">${escapeHtml(title)} is ready for ${escapeHtml(input.storeName)}</h1><p>${escapeHtml(message)}</p><a href="${escapeHtml(dashboardUrl)}"><img src="${escapeHtml(image.href)}" alt="${escapeHtml(title)} with the ${escapeHtml(input.storeName)} logo" width="480" style="display:block;width:100%;max-width:480px;height:auto;border:0" /></a><p>${escapeHtml(instructions)}</p><p><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#dc2626;color:white;padding:12px 20px;border-radius:6px;text-decoration:none">${action}</a></p><p>Your storefront: <a href="${escapeHtml(storeUrl)}">${escapeHtml(storeUrl)}</a></p><p style="font-size:13px;color:#555">${progress}</p><p>VeryMerch</p></div>`,
  };
}
