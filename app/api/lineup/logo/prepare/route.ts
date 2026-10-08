import { startLogoEnhancement } from "@/lib/lineup/start-logo-enhancement";
import { needsAutomaticEnhancement } from "@/lib/lineup/enhancement-policy";
import { getUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPreparation, preparationView } from "@/lib/lineup/prepared-logo";
export const maxDuration = 60;
export async function POST(request: Request) {
  const user = await getUser();
  if (!user?.email_confirmed_at)
    return Response.json(
      { error: "Sign in and verify your email to prepare a logo." },
      { status: 401 },
    );
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) throw new Error("Choose a logo.");
    const db = createAdminClient();
    let row = await createPreparation(
      db,
      user.id,
      file,
      form.get("removeBackground") !== "false",
    );
    let enhancementError: string | undefined;
    if (
      row.status === "clean" &&
      process.env.FAL_KEY &&
      needsAutomaticEnhancement(row.metadata.width, row.metadata.height)
    ) {
      try {
        row = await startLogoEnhancement(db, row);
      } catch (e) {
        enhancementError =
          e instanceof Error
            ? e.message
            : "Automatic enhancement could not start.";
      }
    }
    return Response.json({
      ...(await preparationView(db, row)),
      ...(enhancementError ? { error: enhancementError } : {}),
    });
  } catch (e) {
    return Response.json(
      {
        error: e instanceof Error ? e.message : "Could not prepare this image.",
      },
      { status: 400 },
    );
  }
}
