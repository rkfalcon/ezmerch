# Global product disable status and owner notices

Live inspection of the old embroidered Classic Dad Hat found three product rows, all global_active=false; the generation-history panel was misleadingly showing Generated and review controls. The jobs API now returns current template activity, and both owner/admin generation panels show Disabled globally and suppress review controls for inactive templates.

Added a private security-definer BEFORE UPDATE trigger on active true->false. It queues an owner notification/email only for published, currently globally active products, atomically with the template disable. Drafts and ownerless stores are excluded. Re-saving false does not duplicate notifications; a later enable/disable cycle is a new event. Product IDs are omitted from these notifications to avoid conflict with the existing unique new-product notice key. Public/authenticated execution is revoked.

Migration 20260923200227 was applied to the linked database using db query (not a blanket migration push). A targeted, idempotent backfill queued two owner notices for the already-disabled old embroidered Dad Hat. The other affected product had no store owner. Notices include help@verymerch.com. Product publication preferences and past order records are preserved; global_active remains the enforced availability gate.

Verification: 164 tests passed, TypeScript passed, lint only existing img warnings. The database trigger test checks published-versus-draft targeting, no duplicate on repeated disable, support address, outbox insert, and a new notification on a subsequent disable cycle.
