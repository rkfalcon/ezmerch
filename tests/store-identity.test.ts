import { test } from "node:test";
import assert from "node:assert/strict";
import { storeSlugBase, createWithStoreSlug } from "../lib/onboarding/slug";
import { storeMetadata } from "../lib/store-metadata";
test("clean store names normalize and avoid reserved application URLs", () => {
  assert.equal(storeSlugBase("Mazellist"), "mazellist");
  assert.equal(storeSlugBase("Café & Gifts"), "cafe-gifts");
  assert.equal(storeSlugBase("Dashboard"), "dashboard-store");
  assert.equal(storeSlugBase("Reset Password"), "reset-password-store");
});
test("only collisions get a readable numeric suffix; other failures are not retried", async () => {
  const slugs: string[] = [];
  assert.equal(
    await createWithStoreSlug("Mazellist", async (slug) => {
      slugs.push(slug);
      return slugs.length === 1
        ? { data: null, error: { code: "23505", message: "Duplicate" } }
        : { data: "store-id", error: null };
    }),
    "store-id",
  );
  assert.deepEqual(slugs, ["mazellist", "mazellist-2"]);
  await assert.rejects(
    () =>
      createWithStoreSlug("Mazellist", async () => ({
        data: null,
        error: { code: "42501", message: "Denied" },
      })),
    /Denied/,
  );
});
test("store title and sharing metadata use its clean URL, name and current logo", () => {
  const m = storeMetadata({
    name: "Mazellist",
    slug: "mazellist",
    logo_url: "https://example.com/logo.png",
  });
  assert.equal(m.title, "EzMerch - Mazellist");
  assert.equal(m.description, m.title);
  assert.equal(m.openGraph?.url, "https://www.ezmerch.store/mazellist");
  assert.deepEqual(m.openGraph?.images, [
    { url: "https://example.com/logo.png", alt: "Mazellist logo" },
  ]);
  assert.equal(m.twitter?.title, m.title);
});
