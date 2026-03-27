import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next");

  const supabase = await createClient();
  let authenticated = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) authenticated = true;
  }

  if (!authenticated && token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email",
    });
    if (!error) authenticated = true;
  }

  if (authenticated) {
    // If we have an explicit next param, use it
    if (next) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // Otherwise check if the user has a pending redirect in their metadata
    const { data: { user } } = await supabase.auth.getUser();
    const pendingRedirect = user?.user_metadata?.pending_redirect;
    if (pendingRedirect) {
      // Clear the pending redirect
      await supabase.auth.updateUser({
        data: { pending_redirect: null },
      });
      return NextResponse.redirect(`${origin}${pendingRedirect}`);
    }

    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
