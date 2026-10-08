# Product publishing action clarity

Mazellist's new DTF Dad Hat (6647ea03-3a26-4677-b64d-68f5d23617b4) was created September 24 at 15:53:51 UTC as an intentional draft addition: global_active=true, published=false, generation completed, publish_on_complete=false. It is distinct from the old globally disabled embroidery template. The new-product email requested sales enablement, not artwork approval.

The existing product publishing control was a clickable Draft/Published badge, with the descriptive action only exposed through aria-label. Replaced this with a static status badge and visible Publish product / Hide product button. Clarified in the color dialog that saving color choices does not publish a draft. No publishing behavior, authorization, or product records changed.

TypeScript passed; scoped ESLint had only existing image warnings. Production alias verified in /tmp/product-publish-button-deploy.log. No actual customer product was published by verification.
