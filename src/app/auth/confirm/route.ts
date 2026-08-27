import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Token-hash sign-in (magic link, invite, recovery). Unlike the PKCE code
 * flow, this works from any browser or device, not just the one that
 * requested the email.
 */
function publicOrigin(requestUrl: string): string {
  // On Netlify the function sees its internal deploy URL, not the custom
  // domain. Always redirect on the configured public URL.
  return process.env.NEXT_PUBLIC_APP_URL || new URL(requestUrl).origin;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = publicOrigin(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/app";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("Sign-in link is invalid or expired. Request a new one.")}`);
}
