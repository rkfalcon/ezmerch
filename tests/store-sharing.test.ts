import { test } from "node:test";
import assert from "node:assert/strict";
import {
  storeSharingGuide,
  renderDeveloperEmail,
  defaultDeveloperTemplate,
  validateDeveloperTemplate,
} from "../lib/sharing/guide";
const store = { name: "A & B <Shop>", slug: "a-b" };
test("all platforms and both paste-ready HTML snippets use the canonical store URL", () => {
  const guide = storeSharingGuide(store);
  assert.equal(guide.url, "https://www.verymerch.com/a-b");
  assert.deepEqual(
    guide.platforms.map((p) => p.name),
    [
      "WordPress",
      "Shopify",
      "Wix",
      "Google Business Profile",
      "HTML / any website",
    ],
  );
  assert.match(guide.linkCode, /href="https:\/\/www.verymerch.com\/a-b"/);
  assert.match(guide.buttonCode, /rel="noopener noreferrer"/);
  assert.doesNotMatch(guide.linkCode, /<Shop>/);
  for (const platform of guide.platforms)
    assert.match(
      guide.instructions,
      new RegExp(platform.name.replace("/", "\\/")),
    );
  assert.ok(guide.instructions.includes(guide.linkCode));
  assert.ok(guide.instructions.includes(guide.buttonCode));
});
test("developer email includes the entire guide even if admin removes its placeholder, and escapes raw code for display", () => {
  const guide = storeSharingGuide(store);
  const rendered = renderDeveloperEmail(defaultDeveloperTemplate, store);
  assert.ok(rendered.text.includes(guide.instructions));
  assert.ok(rendered.html.includes("&lt;a href="));
  assert.doesNotMatch(rendered.html, /<Shop>/);
  assert.ok(
    renderDeveloperEmail(
      { subject: "For {store_name}", body: "Custom introduction" },
      store,
    ).text.includes(guide.instructions),
  );
  assert.equal(rendered.text.split("\nWordPress\n").length, 2);
});
test("template validation rejects multiline subjects, unknown placeholders and missing text", () => {
  assert.equal(validateDeveloperTemplate(defaultDeveloperTemplate), null);
  assert.ok(
    validateDeveloperTemplate({ subject: "Hello\nBcc: x@y.com", body: "x" }),
  );
  assert.ok(
    validateDeveloperTemplate({ subject: "Hello", body: "{bad_variable}" }),
  );
  assert.ok(validateDeveloperTemplate({ subject: "Hello", body: "" }));
});
