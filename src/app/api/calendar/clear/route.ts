import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { mondayDate, startDate, endDate, eventIds } = body;

    // 1. Resolve Google OAuth provider_token
    const cookieStore = cookies();
    const tokenFromCookie = cookieStore.get("google_provider_token")?.value;
    const authHeader = request.headers.get("authorization");
    const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;
    const tokenFromBody = body.providerToken;

    let providerToken = tokenFromBody || tokenFromHeader || tokenFromCookie;

    if (!providerToken) {
      // Try to read provider_token from Supabase SSR session
      try {
        const supabase = createServerSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.provider_token) {
          providerToken = session.provider_token;
        }
      } catch {
        // Continue to token check
      }
    }

    if (!providerToken) {
      return NextResponse.json(
        {
          success: false,
          error: "MISSING_TOKEN",
          message: "Please reconnect Google Calendar to grant event access.",
        },
        { status: 401 }
      );
    }

    // 2. Collect target event IDs to delete
    const targetIds = new Set<string>();
    if (Array.isArray(eventIds)) {
      eventIds.filter(Boolean).forEach((id: string) => targetIds.add(id));
    }

    // Determine time range for Google Calendar query
    let timeMin: string;
    let timeMax: string;

    if (startDate && endDate) {
      timeMin = `${startDate}T00:00:00Z`;
      timeMax = `${endDate}T23:59:59Z`;
    } else if (mondayDate) {
      timeMin = `${mondayDate}T00:00:00Z`;
      const d = new Date(mondayDate + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + 7);
      timeMax = d.toISOString().split("T")[0] + "T23:59:59Z";
    } else {
      // Default: past 7 days to next 14 days
      const now = new Date();
      const past = new Date(now.getTime() - 7 * 86400000);
      const future = new Date(now.getTime() + 14 * 86400000);
      timeMin = past.toISOString();
      timeMax = future.toISOString();
    }

    // 3. Search Google Calendar for events containing 'ReboundFit' within the range
    try {
      const searchUrl = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
      searchUrl.searchParams.set("timeMin", timeMin);
      searchUrl.searchParams.set("timeMax", timeMax);
      searchUrl.searchParams.set("q", "ReboundFit");
      searchUrl.searchParams.set("singleEvents", "true");
      searchUrl.searchParams.set("maxResults", "100");

      const searchRes = await fetch(searchUrl.toString(), {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      if (searchRes.status === 401 || searchRes.status === 403) {
        return NextResponse.json(
          {
            success: false,
            error: "INSUFFICIENT_SCOPE",
            message: "Please reconnect Google Calendar to grant event access.",
          },
          { status: 403 }
        );
      }

      if (searchRes.ok) {
        const data = await searchRes.json();
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            // Verify event belongs to ReboundFit before targeting for deletion
            const isReboundFitEvent =
              (item.summary && item.summary.includes("ReboundFit")) ||
              (item.description && item.description.includes("ReboundFit"));
            if (isReboundFitEvent && item.id) {
              targetIds.add(item.id);
            }
          }
        }
      }
    } catch (searchErr) {
      console.warn("Failed searching Google Calendar for ReboundFit events:", searchErr);
    }

    // 4. Batch delete targeted events via DELETE /calendars/primary/events/{eventId}
    let deletedCount = 0;
    for (const eventId of Array.from(targetIds)) {
      try {
        const delRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(
            eventId
          )}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${providerToken}`,
            },
          }
        );

        if (delRes.status === 401 || delRes.status === 403) {
          return NextResponse.json(
            {
              success: false,
              error: "INSUFFICIENT_SCOPE",
              message: "Please reconnect Google Calendar to grant event access.",
            },
            { status: 403 }
          );
        }

        // 204 No Content or 404 Not Found (already deleted) are considered successfully removed
        if (delRes.status === 204 || delRes.status === 200 || delRes.status === 404) {
          deletedCount++;
        }
      } catch (delErr) {
        console.warn(`Failed to delete event ${eventId}:`, delErr);
      }
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: "Cleared synced workouts from Google Calendar.",
    });
  } catch (err: any) {
    console.error("Calendar clear route exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message || "Failed to clear calendar events.",
      },
      { status: 500 }
    );
  }
}
