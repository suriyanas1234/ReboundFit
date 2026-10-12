import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/";
  const origin = requestUrl.origin;

  if (code) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data?.user) {
        // Exchange succeeded and user session is active.
        const response = NextResponse.redirect(`${origin}${next}`);
        if (data.session?.provider_token) {
          response.cookies.set("google_provider_token", data.session.provider_token, {
            path: "/",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 3600 * 24 * 7,
          });
        }
        if (data.session?.provider_refresh_token) {
          response.cookies.set("google_provider_refresh_token", data.session.provider_refresh_token, {
            path: "/",
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 3600 * 24 * 30,
          });
        }
        return response;
      }

      if (error) {
        console.error("Auth callback code exchange error:", error.message);
        return NextResponse.redirect(
          `${origin}/?auth_error=${encodeURIComponent(error.message)}`
        );
      }
    } catch (err: any) {
      console.error("Auth callback unexpected error:", err);
      return NextResponse.redirect(
        `${origin}/?auth_error=${encodeURIComponent(err.message || "Failed to exchange auth session")}`
      );
    }
  }

  // Fallback if no auth code present
  return NextResponse.redirect(`${origin}/`);
}
