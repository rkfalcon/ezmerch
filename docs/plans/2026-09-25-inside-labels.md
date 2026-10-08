# VeryMerch native inside labels

Approved scope: attach the supplied VeryMerch branding to supported clothing across stores and provide an admin catalog compatibility filter.

- Artwork: supplied black/white SVGs, rendered without changing artwork, trimmed transparent margins, fitted proportionally into a transparent 900 × 339 PNG at 300 DPI. Versioned public assets under `/branding/inside-label-v1-{black,white}.png`.
- Policy: for DTG/DTF/embroidery catalog products, prefer catalog `label_inside`, fall back to `label_inside_dtf`. Native template supplies garment size/material/origin. Unsupported items remain unchanged; outside label conflicts fail explicitly.
- Color: choose the higher-contrast black/white artwork using catalog color luminance. Unknown color fails instead of silently selecting an unsuitable label.
- Both lineup and manual supplier-product creation attach labels. Existing sync products are updated separately, preserving all variant IDs and exterior production file IDs. Backups are under `~/.codex/backups/verymerch-inside-labels-2026-09-25`.
- Owner earnings estimates include catalog label surcharge. Checkout uses supplier estimates for actual synced files.
- Admin catalog checkbox: Supports custom inside labels (native print). Combines with technique/category/search. Compatibility badges are displayed on catalog cards.

Current compatibility: Bella + Canvas 3001 and 3501, Cotton Heritage MC1790, Gildan 18500 supported. Comfort Colors 1717 has only outside-label support; left unchanged pending the owner's decision. Hats/accessories are not silently treated as supporting neck labels.

Validation: test supplier products accepted standard and DTF native labels for Black/White garments. Both source files processed successfully with hashes and 900 × 339 dimensions. No orders were placed. Both temporary test products were deleted after successful cost quotes. Local tests cover support detection, color selection, conflicts, idempotence, all-variant attachment, and label-inclusive earnings. Existing worker publication integration remains passing.

Backfill command: `npx tsx --env-file=.env.local scripts/apply-inside-labels.ts --apply`. Omit `--apply` for audit. Run against the active configured account. This updates supplier products only; it does not publish drafts, modify store color choices/prices, or send emails. Preview files returned by Printful are excluded from production file updates because the API rejects their placement type.


Printful replaces native label source attachments asynchronously with generated 900 × 900 temporary printfiles. These have no source URL/hash; this is not a processing failure. Verify their rendered preview against normalized source artwork, not only their hash. `scripts/verify-inside-labels.ts` checks every backed-up sync variant, preserves exterior file IDs/prices, and compares generated label art to the expected tone. Reapplying the backfill can regenerate these composites; verify after any reapplication.

Completed rollout: 74 supplier sync records / 3,194 size-color variants verified, including 209 distinct native rendered label images. Exterior production artwork IDs and supplier retail prices were preserved. The native printed-label filter matches 91 current catalog products. All 200 automated tests pass; TypeScript and targeted lint pass (existing catalog `<img>` advisory only). Production deployment: `ezmerch-i00coz79q-9i9e.vercel.app`. Signed-in admin browser verification was unavailable because both browser sessions required login. No orders were placed or charged.

## Updated artwork (v2)

Replaced production references with `inside-label-v2-{black,white}.png` from the supplied `VeryMerch (3 x 1.3 in) {black,white}-inside.svg` files. The larger URL is preserved; exports remain transparent 900 × 339 PNGs at 300 DPI. Versioned URLs prevent supplier cache reuse. Original v1 assets remain for historical references. The replacement rollout uses a separate backup directory, `~/.codex/backups/verymerch-inside-labels-v2-2026-09-25`, and verifies supplier-rendered labels against v2 artwork while preserving exterior artwork and retail prices.
