# Resend notifications

EZMerch emails admins and affected store owners about new draft products, Printful availability changes, and fulfillment failures. Dashboard alerts remain available even when email is disabled.

1. In Resend → Domains, add `updates.ezmerch.store` (or use a domain you have already verified).
2. Add the exact DNS records Resend provides at the domain's DNS provider. Keep existing mail records. Wait for Resend to show Verified.
3. In Resend → API Keys, create a Sending access key restricted to this domain.
4. In Vercel → ezmerch → Settings → Environment Variables, add the key as `RESEND_API_KEY` for Production. Never put it in a public variable, source control, or chat.
5. Set `NOTIFICATION_FROM_EMAIL` to `EZMerch <notifications@updates.ezmerch.store>` (adjust if using another verified domain).
6. Keep `LINEUP_EMAIL_ENABLED=false` until the sender is verified and queued messages are reviewed. Then set it to `true` and redeploy.

The worker sends at most five queued messages per run. Provider errors retry with backoff, up to five attempts; Resend idempotency keys prevent duplicate sends. Missing configuration is checked before consuming attempts. Existing pending messages will also send when enabled. Review those before activation if old alerts should not be sent.

Confirm an actual notification arrives and appears in Resend's email log. An accepted API response confirms submission, not inbox delivery. If sending fails, inspect `notification_emails.last_error` and Resend's logs.

# Printful availability

A signed Printful v2 webhook requests a fresh check, and a Vercel cron runs every five minutes. Each run checks up to three due templates; successful checks are due again after 30 minutes, failed checks after 15 minutes. Newly added templates are included automatically. Large catalogs can take longer to reconcile.

Checks use the configured decoration technique and US selling region, matching the US-only checkout. Supplier availability is separate from global/local visibility settings. Products retain their prices, artwork, and owner choices. Unavailable variants cannot be selected; products with no available variants display Sold out. Exact variant availability is checked again before creating a Stripe payment. Provider failures block new checkout attempts without claiming that a product is discontinued.

`PRINTFUL_STOCK_WEBHOOK_SECRET` is the hexadecimal signing key returned by Printful v2 webhook registration. It is server-only. New catalog product IDs are subscribed automatically without rotating this key. The webhook payload is treated only as a refresh signal; stock data is fetched from Printful.

Stock checks do not create replacements or automatically refund paid orders. Fulfillment failures generate an alert for manual review. New catalog variants that have never been generated need artwork generation before they can be offered.
