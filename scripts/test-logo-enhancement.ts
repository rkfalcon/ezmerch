/** Real-provider smoke test. Requires explicit TEST_LOGO_ENHANCEMENT=1 and a local app using the same environment. */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import sharp from "sharp";
import assert from "node:assert/strict";
async function main() {
  if (process.env.TEST_LOGO_ENHANCEMENT !== "1")
    throw Error(
      "Set TEST_LOGO_ENHANCEMENT=1 to authorize one paid synthetic enhancement.",
    );
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const email = `logo-quality-${crypto.randomUUID()}@example.com`,
    password = crypto.randomUUID();
  const {
    data: { user },
    error,
  } = await db.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !user) throw error || Error("No test user");
  let preparationId: string | undefined;
  try {
    const cookies: { name: string; value: string }[] = [];
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookies,
          setAll: (items) => {
            cookies.splice(0, cookies.length, ...items);
          },
        },
      },
    );
    const signed = await auth.auth.signInWithPassword({ email, password });
    if (signed.error) throw signed.error;
    const headers = {
      cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
    };
    const base = process.env.LOGO_TEST_BASE_URL || "http://localhost:3107";
    const logo = await sharp(
      Buffer.from(
        '<svg width="400" height="400"><rect width="400" height="400" fill="white"/><path d="M80 320 L200 60 L320 320Z" fill="#155e75"/><circle cx="200" cy="230" r="40" fill="#eab308"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    const form = new FormData();
    form.set(
      "logo",
      new File([new Uint8Array(logo)], "synthetic-logo.png", {
        type: "image/png",
      }),
    );
    form.set("removeBackground", "true");
    async function json(path: string, options: RequestInit = {}) {
      const r = await fetch(base + path, {
        ...options,
        headers: { ...headers, ...options.headers },
      });
      const body = await r.json();
      assert.equal(r.status, 200, JSON.stringify(body));
      return body;
    }
    let row = await json("/api/lineup/logo/prepare", {
      method: "POST",
      body: form,
    });
    preparationId = row.id;
    assert(row.enhancementAvailable);
    assert.equal(row.status, "queued", "Small logo should start enhancement automatically during preparation");
    assert(row.preview);
    assert(row.original);
    const reused = await json("/api/lineup/logo/prepare", {
      method: "POST",
      body: form,
    });
    assert.equal(reused.id, row.id);
    const unauth = await fetch(base + "/api/lineup/logo/enhance?id=" + row.id);
    assert.equal(unauth.status, 401);
    row = await json("/api/lineup/logo/enhance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: row.id }),
    });
    const start = Date.now();
    while (row.status === "queued" && Date.now() - start < 180000) {
      await new Promise((r) => setTimeout(r, 6000));
      row = await json("/api/lineup/logo/enhance?id=" + row.id);
    }
    assert.equal(row.status, "enhanced");
    assert.equal(row.enhancedMetadata.enhanced, true);
    const png = Buffer.from(await (await fetch(row.enhanced)).arrayBuffer());
    const meta = await sharp(png).metadata();
    assert(meta.hasAlpha);
    assert(meta.width! > row.metadata.width);
    console.log(
      JSON.stringify({
        status: "passed",
        seconds: Math.round((Date.now() - start) / 1000),
        source: [row.metadata.width, row.metadata.height],
        enhanced: [meta.width, meta.height],
        alpha: meta.hasAlpha,
        cachedPreparation: true,
        unauthenticatedRejected: true,
      }),
    );
  } finally {
    if (preparationId) {
      const prefix = `${user.id}/${preparationId}`;
      const { data } = await db.storage.from("logo-originals").list(prefix);
      if (data?.length)
        await db.storage
          .from("logo-originals")
          .remove(data.map((f) => prefix + "/" + f.name));
    }
    await db.from("logo_preparations").delete().eq("user_id", user.id);
    const removed = await db.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
