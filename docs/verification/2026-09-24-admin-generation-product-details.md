# Admin generation cards match saved store product settings

The prior price/earnings addition covered product tables, but the admin screenshot showed the generation cards above the tabs. Those cards used generation mockups, not the owner's selected display color, and had no saved product price summary.

Jobs API now joins store products by template ID (scoped to the authorized store), returning saved variant prices, current publication status, and the display image chosen by the shared product-color logic. Current ready images override the generation thumbnail only after first publication or completion. Pending previous-logo variants and old thumbnail fallbacks are excluded. Admin generation cards render the shared price/earnings component in read-only mode. Polling refreshes these saved details without waiting for generation changes.

Validation: TypeScript passed; six relevant earnings/default-thumbnail tests passed; lint only existing image warnings. Production deployment alias confirmed in /tmp/admin-product-summary-deploy.log. No owner price or color settings changed.
