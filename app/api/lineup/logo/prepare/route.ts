import { getUser } from "@/lib/auth";
import { prepareLogo } from "@/lib/lineup/logo-preparation";
export async function POST(request: Request) {
  if (!(await getUser()))
    return Response.json(
      { error: "Sign in to prepare your logo." },
      { status: 401 },
    );
  try {
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File) || !file.size || file.size > 4 * 1024 * 1024)
      throw new Error("Choose a logo under 4 MB.");
    const result = await prepareLogo(
      Buffer.from(await file.arrayBuffer()),
      form.get("removeBackground") !== "false",
    );
    return Response.json({
      preview: `data:image/png;base64,${result.bytes.toString("base64")}`,
      warnings: result.warnings,
      width: result.width,
      height: result.height,
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
