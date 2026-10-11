/**
 * ReboundFit Google Calendar Synchronization Utility
 * Supports:
 * 1. 1-Tap Google Calendar Web URL generation (zero permission friction, works on mobile & desktop)
 * 2. iCalendar (.ics) export for batch importing entire weeks or months into Google Calendar
 * 3. Direct Google Calendar REST API event creation when an OAuth provider token is available
 */

export interface CalendarEventPayload {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, default "08:00"
  durationMinutes?: number; // default 60
  details?: string;
  location?: string;
  exerciseNames?: string[];
}

/**
 * Builds a direct Google Calendar web intent URL that opens Google Calendar
 * with the workout session pre-populated and ready to save.
 */
export function buildGoogleCalendarUrl(event: CalendarEventPayload): string {
  const time = event.time || "08:00";
  const durationMinutes = event.durationMinutes || 60;
  
  // Format local date and time: YYYYMMDDTHHmmSS
  const cleanDate = event.date.replace(/-/g, "");
  const [hh, mm] = time.split(":");
  const startStr = `${cleanDate}T${hh || "08"}${mm || "00"}00`;

  // Calculate end time
  const startHours = parseInt(hh || "8", 10);
  const startMins = parseInt(mm || "0", 10);
  const totalStartMins = startHours * 60 + startMins;
  const totalEndMins = totalStartMins + durationMinutes;
  const endHours = Math.floor((totalEndMins / 60) % 24).toString().padStart(2, "0");
  const endMins = (totalEndMins % 60).toString().padStart(2, "0");
  const endStr = `${cleanDate}T${endHours}${endMins}00`;

  let description = event.details || "";
  if (event.exerciseNames && event.exerciseNames.length > 0) {
    description += "\n\nPlanned Routine:\n" + event.exerciseNames.map((name, i) => `${i + 1}. ${name}`).join("\n");
  }
  description += "\n\nTrack progressive overload sets on ReboundFit.";

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `🏋️‍♂️ ReboundFit: ${event.title}`,
    dates: `${startStr}/${endStr}`,
    details: description,
    location: event.location || "Gym",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Generates an RFC 5545 compliant iCalendar (.ics) string for a list of scheduled workouts.
 * Google Calendar, Apple Calendar, and Outlook can import this file seamlessly.
 */
export function generateIcsCalendar(events: CalendarEventPayload[]): string {
  const nowStr = new Date().toISOString().replace(/-|:|\.\d\d\d/g, "");

  const icsLines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ReboundFit//Workout Scheduler v1.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:ReboundFit Workout Schedule",
    "X-WR-TIMEZONE:UTC",
  ];

  events.forEach((ev, idx) => {
    const time = ev.time || "08:00";
    const duration = ev.durationMinutes || 60;
    const cleanDate = ev.date.replace(/-/g, "");
    const [hh, mm] = time.split(":");
    const startStr = `${cleanDate}T${hh || "08"}${mm || "00"}00`;

    const startH = parseInt(hh || "8", 10);
    const startM = parseInt(mm || "0", 10);
    const totalStartMins = startH * 60 + startM;
    const totalEndMins = totalStartMins + duration;
    const endH = Math.floor((totalEndMins / 60) % 24).toString().padStart(2, "0");
    const endM = (totalEndMins % 60).toString().padStart(2, "0");
    const endStr = `${cleanDate}T${endH}${endM}00`;

    let desc = ev.details || "ReboundFit Training Session";
    if (ev.exerciseNames && ev.exerciseNames.length > 0) {
      desc += "\\n\\nExercises:\\n" + ev.exerciseNames.map((n, i) => `${i + 1}. ${n}`).join("\\n");
    }

    icsLines.push(
      "BEGIN:VEVENT",
      `UID:reboundfit-${ev.date}-${idx}-${Date.now()}@reboundfit.app`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:🏋️‍♂️ ReboundFit: ${ev.title}`,
      `DESCRIPTION:${desc.replace(/\n/g, "\\n")}`,
      `LOCATION:${ev.location || "Gym"}`,
      "STATUS:CONFIRMED",
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Reminder: Time to hit your ReboundFit workout!",
      "END:VALARM",
      "END:VEVENT"
    );
  });

  icsLines.push("END:VCALENDAR");
  return icsLines.join("\r\n");
}

/**
 * Triggers a browser file download of the generated .ics calendar file.
 */
export function downloadIcsFile(filename: string, icsContent: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Directly pushes an event to Google Calendar via Google Calendar REST API
 * using an authenticated Google OAuth access token.
 */
export async function createGoogleCalendarApiEvent(
  accessToken: string,
  event: CalendarEventPayload
): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const time = event.time || "08:00";
    const duration = event.durationMinutes || 60;
    
    // Construct local start & end ISO strings
    const startIso = `${event.date}T${time}:00`;
    const [h, m] = time.split(":").map(Number);
    const endMinsTotal = h * 60 + m + duration;
    const endH = Math.floor((endMinsTotal / 60) % 24).toString().padStart(2, "0");
    const endM = (endMinsTotal % 60).toString().padStart(2, "0");
    const endIso = `${event.date}T${endH}:${endM}:00`;

    // Local time zone
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

    let description = event.details || "";
    if (event.exerciseNames && event.exerciseNames.length > 0) {
      description += "\n\nPlanned Routine:\n" + event.exerciseNames.map((n, i) => `${i + 1}. ${n}`).join("\n");
    }
    description += "\n\nTrack progress with progressive overload on ReboundFit.";

    const body = {
      summary: `🏋️‍♂️ ReboundFit: ${event.title}`,
      description,
      location: event.location || "Gym",
      start: {
        dateTime: `${startIso}`,
        timeZone,
      },
      end: {
        dateTime: `${endIso}`,
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

    const response = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errData?.error?.message || `HTTP ${response.status} failed to create Google Calendar event`,
      };
    }

    const created = await response.json();
    return { success: true, eventId: created.id };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to reach Google Calendar API" };
  }
}
