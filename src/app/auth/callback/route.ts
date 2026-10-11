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
        // Redirect directly to the requested destination (default: /).
        // AppShell handles gating: if onboarding is complete, dashboard loads;
        // if not completed yet, the onboarding wizard is presented cleanly.
        return NextResponse.redirect(`${origin}${next}`);
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
