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
        // Query user's profile to verify onboarding completion status
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, target_calories")
          .eq("id", data.user.id)
          .maybeSingle();

        // If user already has a configured profile, send directly to dashboard
        if (profile?.target_calories) {
          return NextResponse.redirect(`${origin}${next}`);
        }

        // If brand-new user or onboarding incomplete, redirect to onboarding
        return NextResponse.redirect(`${origin}/?onboarding=true`);
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
