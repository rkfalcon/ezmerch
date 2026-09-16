import { lineupAdmin } from "@/lib/lineup/access";
import { templatePreview } from "@/lib/lineup/template-preview";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateColorSelection } from "@/lib/product-colors";
import { revalidatePath } from "next/cache";

type Context = { params: Promise<{ templateId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    await lineupAdmin();
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    return Response.json(
      await templatePreview((await context.params).templateId),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not load template" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await lineupAdmin();
  } catch {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    const template = await templatePreview((await context.params).templateId);
    const colors = validateColorSelection(
      template.variants,
      (await request.json()).colors,
    );
    const { error } = await createAdminClient()
      .from("product_templates")
      .update({ enabled_colors: colors })
      .eq("id", template.id)
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/", "layout");
    return Response.json({ colors });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Could not save colors" },
      { status: 400 },
    );
  }
}
