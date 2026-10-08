# Owner dashboard global color visibility

Owner product pages explicitly enable ownerView on the shared color picker and availability pills. Globally disabled colors are excluded from visible choices, searches and counts; admin store and template views retain full inventories. Initial preview selection falls back to a globally allowed color, and an unavailable saved default is described without exposing it as a selectable option. Fully globally disabled products have no owner color choices.

Stored choices for hidden colors remain preserved; enable-all and saving visible choices do not implicitly clear them. Owner-disabled but globally allowed colors remain selectable so owners can re-enable them. Saving with zero visible enabled colors is blocked.

Eight relevant color tests passed. TypeScript passed. ESLint only existing image warnings. Production deployment log: /tmp/owner-visible-colors-deploy.log. No store preferences modified during verification.
