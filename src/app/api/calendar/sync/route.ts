import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

interface SyncEventItem {
  id?: string;
  workoutId?: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  details?: string;
  location?: string;
  exerciseNames?: string[];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const events: SyncEventItem[] = Array.isArray(body.events) ? body.events : [];

    if (events.length === 0) {
      return NextResponse.json(
        { success: false, error: "NO_EVENTS", message: "No workout events provided to sync." },
        { status: 400 }
      );
    }

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
        const { data: { session } } = await supabase.auth.getSession();
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

    // 2. Perform event insertions via Google Calendar REST API v3
    let successCount = 0;
    const results: { workoutId?: string; date: string; eventId?: string; error?: string }[] = [];

    for (const event of events) {
      const time = event.time || "08:00";
      const duration = event.durationMinutes || 60;

      const startIso = `${event.date}T${time}:00`;
      const [h, m] = time.split(":").map(Number);
      const endMinsTotal = (h || 8) * 60 + (m || 0) + duration;
      const endH = Math.floor((endMinsTotal / 60) % 24).toString().padStart(2, "0");
      const endM = (endMinsTotal % 60).toString().padStart(2, "0");
      const endIso = `${event.date}T${endH}:${endM}:00`;

      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      let description = event.details || "";
      if (event.exerciseNames && event.exerciseNames.length > 0) {
        description += "\n\nPlanned Routine:\n" + event.exerciseNames.map((n, i) => `${i + 1}. ${n}`).join("\n");
      }
      description += "\n\nTrack progress with progressive overload on ReboundFit.";

      const eventPayload = {
        summary: `🏋️‍♂️ ReboundFit: ${event.title}`,
        description,
        location: event.location || "Gym",
        start: {
          dateTime: startIso,
          timeZone,
        },
        end: {
          dateTime: endIso,
          timeZone,
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
            { method: "notification", minutes: 15 },
          ],
        },
      };

      const googleRes = await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${providerToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(eventPayload),
        }
      );

      // Handle Permission / Scope / Token Expiration errors from Google Calendar REST API v3
      if (googleRes.status === 401 || googleRes.status === 403) {
        const errJson = await googleRes.json().catch(() => ({}));
        console.warn("Google Calendar scope/auth error:", googleRes.status, errJson);
        return NextResponse.json(
          {
            success: false,
            error: "INSUFFICIENT_SCOPE",
            message: "Please reconnect Google Calendar to grant event access.",
            details: errJson?.error?.message || "Insufficient scope permissions or token expired.",
          },
          { status: 403 }
        );
      }

      if (!googleRes.ok) {
        const errJson = await googleRes.json().catch(() => ({}));
        results.push({
          workoutId: event.workoutId || event.id,
          date: event.date,
          error: errJson?.error?.message || `HTTP ${googleRes.status}`,
        });
        continue;
      }

      const createdEvent = await googleRes.json();
      successCount++;
      results.push({
        workoutId: event.workoutId || event.id,
        date: event.date,
        eventId: createdEvent.id,
      });
    }

    return NextResponse.json({
      success: true,
      syncedCount: successCount,
      totalRequested: events.length,
      results,
    });
  } catch (err: any) {
    console.error("Calendar sync route exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message || "Failed to process calendar synchronization.",
      },
      { status: 500 }
    );
  }
}
