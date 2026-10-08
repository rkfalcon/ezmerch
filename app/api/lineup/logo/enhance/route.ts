import { startLogoEnhancement } from "@/lib/lineup/start-logo-enhancement";
import sharp from "sharp";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  preparation,
  preparationView,
  readLogo,
  writeLogo,
  privateLogos,
} from "@/lib/lineup/prepared-logo";
import { enhancementResult, restoreLogoAlpha } from "@/lib/lineup/fal-upscale";
export const maxDuration = 60;
export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.email_confirmed_at)
    return Response.json(
      { error: "Sign in and verify your email." },
      { status: 401 },
    );
  const db = createAdminClient();
  try {
    const { id } = await request.json();
    const row = await preparation(db, id, user.id);
    return Response.json(
      await preparationView(db, await startLogoEnhancement(db, row)),
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Enhancement unavailable." },
      { status: 400 },
    );
  }
}
export async function GET(request: Request) {
  const user = await getUser();
  if (!user)
    return Response.json({ error: "Sign in required." }, { status: 401 });
  const db = createAdminClient();
  try {
    const id = new URL(request.url).searchParams.get("id") ?? "";
    let row = await preparation(db, id, user.id);
    if (row.status === "queued") {
      const image = await enhancementResult(row.fal_request);
      if (image) {
        const base = `${user.id}/${id}`;
        const clean = await readLogo(db, `${base}/clean.png`);
        const png = await restoreLogoAlpha(clean, image, row.fal_request.scale);
        await writeLogo(db, `${base}/enhanced.png`, png);
        const { width, height } = await sharp(png).metadata();
        const { error } = await db
          .from("logo_preparations")
          .update({
            status: "enhanced",
            enhanced_metadata: {
              ...row.metadata,
              width,
              height,
              enhanced: true,
              reviewed: false,
            },
            last_error: null,
          })
          .eq("id", id)
          .eq("status", "queued");
        if (error) throw error;
        row = await preparation(db, id, user.id);
      }
    }
    return Response.json(await preparationView(db, row));
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Could not check enhancement.",
      },
      { status: 400 },
    );
  }
}
