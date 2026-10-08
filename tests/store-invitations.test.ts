import { test } from "node:test";
import assert from "node:assert/strict";
import {
  renderInvitation,
  defaultInvitationTemplate,
  validateInvitationTemplate,
} from "../lib/invitations/email";

test("invitation renders every product, escapes content, and always includes claim link", () => {
  const result = renderInvitation(
    {
      subject: "Your {store_name}",
      body: "Hello <script>alert(1)</script>\n{store_url}",
    },
    {
      name: "A & B",
      slug: "ab",
      logo_url: "javascript:alert(1)",
      brand_colors: { primary: "red;bad" },
      products: Array.from({ length: 35 }, (_, i) => ({
        title: `Product ${i}`,
        image: "https://example.com/image.png",
      })),
    },
    "https://www.ezmerch.store",
    "https://www.ezmerch.store/claim/test",
  );
  assert.equal(result.subject, "Your A & B");
  assert.match(result.html, /Product 34/);
  assert.match(result.html, /&lt;script&gt;/);
  assert.doesNotMatch(result.html, /javascript:|<script>|red;bad/);
  assert.match(result.html, /href="https:\/\/www.ezmerch.store\/claim\/test"/);
  assert.match(result.text, /Product 34/);
});
test("template validates placeholders and required fields", () => {
  assert.equal(validateInvitationTemplate(defaultInvitationTemplate), null);
  assert.match(
    validateInvitationTemplate({ subject: "", body: "hello" })!,
    /subject/i,
  );
  assert.match(
    validateInvitationTemplate({ subject: "Hi", body: "{unknown}" })!,
    /unknown/i,
  );
});

import { safeAuthRedirect } from "../lib/auth-redirect";
test("auth retains claim destination while rejecting external redirects", () => {
  assert.equal(safeAuthRedirect("/claim/abc"), "/claim/abc");
  for (const value of [
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    null,
  ])
    assert.equal(safeAuthRedirect(value), "/dashboard");
});
