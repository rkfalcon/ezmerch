# Product descriptions and sharing

Product detail descriptions now use a closed-by-default native disclosure below purchase controls. The shared product image includes an accessible sharing menu for X, Facebook, Instagram, email, SMS, copy caption/link, and supported native sharing.

Product metadata includes store name, public product title, canonical URL, and a 1200x630 image. The Instagram flow offers a 1080x1080 downloadable image, caption/link copy, and native file sharing where available. Instagram publishing remains a visitor action; no account access is required. Email/SMS link previews and native share targets depend on the receiving app.

The image endpoint checks public product visibility and enabled in-stock variants, fetches only trusted image hosts, refuses redirects, and preserves the full product image with contain sizing.

Verification: 150 unit tests pass; TypeScript passes; scoped ESLint has only image-element warnings. Browser checks at 390px and desktop confirm collapsed/expandable description, menu links and no horizontal overflow. Both generated image sizes returned HTTP 200 and were visually inspected. No messages or social posts were sent.

## Mobile Facebook handoff follow-up

User confirmed the Facebook link launched the iPhone app without a composer. On devices with a coarse pointer and Web Share support, the Facebook menu action now prevents the universal-link navigation and invokes native sharing synchronously with title, text and product URL. Desktop/unsupported browsers retain the existing web sharing link.

Browser checks with a stubbed native share API verify one complete payload and no new Facebook tab, cancellation without navigation, and the unsupported-browser fallback. TypeScript, scoped lint (existing image warning only), and sharing unit test pass. Actual iPhone Facebook composer remains a device-side verification; no post was sent.

## Instagram link sharing

The Instagram menu action now uses native link sharing on supported touch devices, matching the visitor's demonstrated Instagram direct-message flow. Image download/caption tools remain in a separate Image for a post or Story entry and as the unsupported-device fallback. Browser tests with a stubbed native share API confirm a URL-only (no files) payload and no manual dialog; the separate image workflow remains accessible. TypeScript and sharing unit tests pass. No Instagram message was sent.

## Remove image-sharing workflow

At the user's request, removed Image for a post or Story, the modal, automatic image fetch/File creation, downloads and native file-sharing code from ProductShare. Link sharing remains. A plain selectable text fallback handles unavailable clipboard/native sharing without a modal. This removes the reported browser-hang interaction; the iPhone Chrome hang itself was not independently reproduced. TypeScript, lint and the sharing test pass.

## Instagram return freeze mitigation

User confirmed the freeze persists only after choosing Instagram; removing menu modality did not resolve it. The exact app/browser cause is unconfirmed. Replaced the Instagram native-share action with an explicitly labeled copy-caption/link action, with selectable text fallback if clipboard access fails. Other targets remain unchanged. Browser check confirms zero native-share calls, complete caption/link copy, usable Dismiss and product controls. TypeScript and scoped lint pass. This avoids the affected handoff rather than claiming the iOS freeze is fixed.
