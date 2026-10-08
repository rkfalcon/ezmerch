# Managed artwork preparation

Implemented automatic server selection of completed enhanced artwork, removed owner approval and enhancement choices, and restricted generation approval/retries to admins. New logo sidecars never treat owner input as quality approval.

DTG front designs that fail the preferred print size try bounded smaller layouts and then left-chest placement. Adjusted layouts require EzMerch visual review because resolution cannot establish text legibility. Embroidery and uncertain enhanced artwork remain internal review cases. The effective layout is persisted and reused for rendering, mockups and supplier sync. Admin review includes the exact print file reused for fulfillment.

Failed generations atomically queue admin notifications and emails, deduplicated per generation. Existing Sunday Sauce holds were surfaced: seven emails confirmed sent in the notification queue. Four resolution-blocked DTG designs were prepared at 40% scale (formerly 80%); three embroidery designs retained their layouts. All seven have print files and remain unpublished pending internal review. No supplier orders were placed.

Validation: 99-test full suite passed, plus new server-owned preparation selection test passed; TypeScript passed. PGlite exercised notification backfill and deduplication. Production query confirmed seven review records with proofs. Browser confirmed Sunday Sauce publicly lists only the approved Comfort Colors tee. Authenticated UI verification was unavailable because the browser session was signed out.

Limitations: previews are approximate and generation/enhancement is asynchronous; this does not guarantee instant supplier mockups or physical print quality. Admins must inspect uncertain lettering and embroidery, using samples where appropriate. New uploads with sufficiently detailed originals can pass automatically; AI-enhanced or resized exception designs may need internal review.
