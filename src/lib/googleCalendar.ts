/**
 * ReboundFit Google Calendar Synchronization & Smart Fit Utility
 * Supports:
 * 1. 1-Tap Google Calendar Web URL generation (zero permission friction, works on mobile & desktop)
 * 2. iCalendar (.ics) export for batch importing entire weeks or months into Google Calendar
 * 3. Direct Google Calendar REST API event creation when an OAuth provider token is available
 * 4. Google Calendar event import (via Google REST API, .ics file upload, or demo availability)
 * 5. Free-time slot analysis & intelligent workout fitter (detects conflicts and fits workouts into open windows)
 */

import { LocalScheduledWorkout } from "@/lib/db";

export interface CalendarEventPayload {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm, default "08:00"
  durationMinutes?: number; // default 60
  details?: string;
  location?: string;
  exerciseNames?: string[];
}

export interface ImportedCalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isAllDay: boolean;
  description?: string;
  location?: string;
}

export interface DayFreeSlot {
  start: string; // "07:00"
  end: string; // "08:30"
  durationMinutes: number;
  label: string; // "Morning Window", "Afternoon Window", "Evening Window"
}

export interface DayCalendarAnalysis {
  date: string;
  events: ImportedCalendarEvent[];
  freeSlots: DayFreeSlot[];
  recommendedSlot?: DayFreeSlot;
  hasConflictWithWorkout: boolean;
  conflictDetails?: string;
}

/**
 * Retrieves the Google OAuth provider token from session or cookie.
 */
export function getStoredGoogleProviderToken(session?: any): string | null {
  if (session?.provider_token) return session.provider_token;
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )google_provider_token=([^;]*)/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  return null;
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

    const startIso = `${event.date}T${time}:00`;
    const [h, m] = time.split(":").map(Number);
    const endMinsTotal = h * 60 + m + duration;
    const endH = Math.floor((endMinsTotal / 60) % 24).toString().padStart(2, "0");
    const endM = (endMinsTotal % 60).toString().padStart(2, "0");
    const endIso = `${event.date}T${endH}:${endM}:00`;

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

/**
 * Fetches user's existing events from Google Calendar via REST API.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string
): Promise<{ success: boolean; events: ImportedCalendarEvent[]; error?: string }> {
  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        events: [],
        error: err?.error?.message || `Google Calendar API returned status ${res.status}`,
      };
    }

    const data = await res.json();
    const items = data.items || [];

    const parsed: ImportedCalendarEvent[] = items.map((item: any) => {
      const isAllDay = !!item.start?.date && !item.start?.dateTime;
      let dateStr = "";
      let startTime = "09:00";
      let endTime = "10:00";

      if (isAllDay) {
        dateStr = item.start.date;
        startTime = "00:00";
        endTime = "23:59";
      } else if (item.start?.dateTime) {
        const startDate = new Date(item.start.dateTime);
        dateStr = startDate.toISOString().split("T")[0];
        const hh = startDate.getHours().toString().padStart(2, "0");
        const mm = startDate.getMinutes().toString().padStart(2, "0");
        startTime = `${hh}:${mm}`;

        if (item.end?.dateTime) {
          const endDate = new Date(item.end.dateTime);
          const endH = endDate.getHours().toString().padStart(2, "0");
          const endM = endDate.getMinutes().toString().padStart(2, "0");
          endTime = `${endH}:${endM}`;
        }
      }

      return {
        id: item.id || `gcal-${Math.random()}`,
        title: item.summary || "(No Title)",
        date: dateStr,
        startTime,
        endTime,
        isAllDay,
        description: item.description,
        location: item.location,
      };
    });

    return { success: true, events: parsed };
  } catch (err: any) {
    return {
      success: false,
      events: [],
      error: err.message || "Failed to fetch Google Calendar events",
    };
  }
}

/**
 * Parses raw .ics file content into ImportedCalendarEvent array.
 */
export function parseIcsContent(icsText: string): ImportedCalendarEvent[] {
  const events: ImportedCalendarEvent[] = [];
  const lines = icsText.split(/\r\n|\n|\r/);
  let currentEvent: Partial<ImportedCalendarEvent> | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("BEGIN:VEVENT")) {
      currentEvent = {
        id: `ics-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        isAllDay: false,
      };
    } else if (line.startsWith("END:VEVENT") && currentEvent) {
      if (currentEvent.date && currentEvent.title) {
        events.push({
          id: currentEvent.id || `ics-${Math.random()}`,
          title: currentEvent.title || "Calendar Event",
          date: currentEvent.date,
          startTime: currentEvent.startTime || "09:00",
          endTime: currentEvent.endTime || "10:00",
          isAllDay: !!currentEvent.isAllDay,
          description: currentEvent.description,
          location: currentEvent.location,
        });
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith("SUMMARY:")) {
        currentEvent.title = line.substring(8).trim();
      } else if (line.startsWith("LOCATION:")) {
        currentEvent.location = line.substring(9).trim();
      } else if (line.startsWith("DESCRIPTION:")) {
        currentEvent.description = line.substring(12).trim();
      } else if (line.startsWith("DTSTART")) {
        const val = line.split(":")[1]?.trim() || "";
        if (val.length >= 8) {
          const y = val.substring(0, 4);
          const m = val.substring(4, 6);
          const d = val.substring(6, 8);
          currentEvent.date = `${y}-${m}-${d}`;
          if (val.includes("T")) {
            const timePart = val.split("T")[1];
            if (timePart.length >= 4) {
              currentEvent.startTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
            }
          } else {
            currentEvent.isAllDay = true;
            currentEvent.startTime = "00:00";
          }
        }
      } else if (line.startsWith("DTEND")) {
        const val = line.split(":")[1]?.trim() || "";
        if (val.includes("T")) {
          const timePart = val.split("T")[1];
          if (timePart.length >= 4) {
            currentEvent.endTime = `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
          }
        } else {
          currentEvent.endTime = "23:59";
        }
      }
    }
  }

  return events;
}

/**
 * Generates realistic sample Google Calendar commitments across a reference week.
 * Allows instant testing of the availability & conflict engine without requiring OAuth.
 */
export function generateSampleCalendarEvents(referenceMonday: string): ImportedCalendarEvent[] {
  const events: ImportedCalendarEvent[] = [];
  const start = new Date(referenceMonday + "T00:00:00");

  const sampleTemplates = [
    // Mon
    [
      { title: "Team Sprint Standup", start: "09:00", end: "10:00", loc: "Google Meet" },
      { title: "Product Architecture Review", start: "14:00", end: "15:30", loc: "Office" },
    ],
    // Tue
    [
      { title: "Client Strategy Sync", start: "10:00", end: "11:30", loc: "Zoom" },
      { title: "Team Collaboration Block", start: "15:00", end: "16:30", loc: "Boardroom" },
    ],
    // Wed
    [
      { title: "Design Sprint Review", start: "09:30", end: "10:30", loc: "Google Meet" },
      { title: "Department Lunch", start: "12:30", end: "13:30", loc: "Cafe" },
      { title: "1-on-1 Mentorship", start: "16:00", end: "17:00", loc: "Slack" },
    ],
    // Thu
    [
      { title: "Weekly All-Hands", start: "11:00", end: "12:15", loc: "Google Meet" },
      { title: "Family Dinner", start: "19:00", end: "20:30", loc: "Home" },
    ],
    // Fri
    [
      { title: "Sprint Retrospective & Demo", start: "10:30", end: "12:00", loc: "Auditorium" },
      { title: "Project Wrap-up", start: "15:30", end: "16:45", loc: "Google Meet" },
    ],
    // Sat
    [
      { title: "Morning Grocery & Farmers Market", start: "10:00", end: "11:30", loc: "Market" },
      { title: "Social Gathering", start: "18:00", end: "20:30", loc: "Downtown" },
    ],
    // Sun
    [
      { title: "Weekly Meal Prep & Planning", start: "11:00", end: "12:30", loc: "Kitchen" },
    ],
  ];

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const d = new Date(start);
    d.setDate(start.getDate() + dayOffset);
    const dateStr = d.toISOString().split("T")[0];
    const templates = sampleTemplates[dayOffset] || [];

    templates.forEach((t, i) => {
      events.push({
        id: `sample-${dateStr}-${i}`,
        title: t.title,
        date: dateStr,
        startTime: t.start,
        endTime: t.end,
        isAllDay: false,
        location: t.loc,
      });
    });
  }

  return events;
}

/**
 * Analyzes calendar events for a specific day, finds free workout windows,
 * and detects whether the currently scheduled workout conflicts with any events.
 */
export function analyzeDayCalendarAvailability(
  dateStr: string,
  events: ImportedCalendarEvent[],
  workoutDurationMinutes: number = 60,
  scheduledWorkoutTime?: string
): DayCalendarAnalysis {
  const dayEvents = events
    .filter((e) => e.date === dateStr)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Active training hours window: 06:00 (360m) to 22:00 (1320m)
  const DAY_START_MIN = 6 * 60; // 360 (06:00 AM)
  const DAY_END_MIN = 22 * 60; // 1320 (10:00 PM)

  // Map non-all-day events to minute intervals [startMin, endMin]
  const busyIntervals: [number, number, string][] = [];
  dayEvents.forEach((ev) => {
    if (ev.isAllDay) return;
    const [sh, sm] = ev.startTime.split(":").map(Number);
    const [eh, em] = ev.endTime.split(":").map(Number);
    const startMins = Math.max(DAY_START_MIN, (sh || 0) * 60 + (sm || 0));
    const endMins = Math.min(DAY_END_MIN, (eh || 0) * 60 + (em || 0));
    if (endMins > startMins) {
      busyIntervals.push([startMins, endMins, ev.title]);
    }
  });

  // Sort busy intervals by start
  busyIntervals.sort((a, b) => a[0] - b[0]);

  // Merge overlapping busy intervals for gap calculation
  const mergedBusy: [number, number][] = [];
  busyIntervals.forEach(([s, e]) => {
    if (mergedBusy.length === 0) {
      mergedBusy.push([s, e]);
    } else {
      const last = mergedBusy[mergedBusy.length - 1];
      if (s <= last[1]) {
        last[1] = Math.max(last[1], e);
      } else {
        mergedBusy.push([s, e]);
      }
    }
  });

  // Find free gaps of at least workoutDurationMinutes
  const freeSlots: DayFreeSlot[] = [];
  let currentCursor = DAY_START_MIN;

  mergedBusy.forEach(([busyStart, busyEnd]) => {
    if (busyStart - currentCursor >= workoutDurationMinutes) {
      const dur = busyStart - currentCursor;
      const sh = Math.floor(currentCursor / 60).toString().padStart(2, "0");
      const sm = (currentCursor % 60).toString().padStart(2, "0");
      const eh = Math.floor(busyStart / 60).toString().padStart(2, "0");
      const em = (busyStart % 60).toString().padStart(2, "0");

      let label = "Morning Window";
      if (currentCursor >= 17 * 60) label = "Evening Window";
      else if (currentCursor >= 12 * 60) label = "Afternoon Window";

      freeSlots.push({
        start: `${sh}:${sm}`,
        end: `${eh}:${em}`,
        durationMinutes: dur,
        label,
      });
    }
    currentCursor = Math.max(currentCursor, busyEnd);
  });

  // Tail gap between last busy event and DAY_END_MIN
  if (DAY_END_MIN - currentCursor >= workoutDurationMinutes) {
    const dur = DAY_END_MIN - currentCursor;
    const sh = Math.floor(currentCursor / 60).toString().padStart(2, "0");
    const sm = (currentCursor % 60).toString().padStart(2, "0");
    const eh = Math.floor(DAY_END_MIN / 60).toString().padStart(2, "0");
    const em = (DAY_END_MIN % 60).toString().padStart(2, "0");

    let label = "Evening Window";
    if (currentCursor < 12 * 60) label = "Morning Window";
    else if (currentCursor < 17 * 60) label = "Afternoon Window";

    freeSlots.push({
      start: `${sh}:${sm}`,
      end: `${eh}:${em}`,
      durationMinutes: dur,
      label,
    });
  }

  // Conflict Check with scheduled workout
  let hasConflictWithWorkout = false;
  let conflictDetails: string | undefined = undefined;

  if (scheduledWorkoutTime) {
    const [wh, wm] = scheduledWorkoutTime.split(":").map(Number);
    const workoutStartMins = (wh || 8) * 60 + (wm || 0);
    const workoutEndMins = workoutStartMins + workoutDurationMinutes;

    for (const [bs, be, title] of busyIntervals) {
      if (workoutStartMins < be && workoutEndMins > bs) {
        hasConflictWithWorkout = true;
        const bsh = Math.floor(bs / 60).toString().padStart(2, "0");
        const bsm = (bs % 60).toString().padStart(2, "0");
        const beh = Math.floor(be / 60).toString().padStart(2, "0");
        const bem = (be % 60).toString().padStart(2, "0");
        conflictDetails = `Overlaps with "${title}" (${bsh}:${bsm} - ${beh}:${bem})`;
        break;
      }
    }
  }

  // Pick recommended slot: prefer morning (07:00-09:00) or highest duration
  let recommendedSlot = freeSlots.find((s) => s.label === "Morning Window" && s.durationMinutes >= workoutDurationMinutes);
  if (!recommendedSlot) {
    recommendedSlot = freeSlots.find((s) => s.label === "Evening Window" && s.durationMinutes >= workoutDurationMinutes);
  }
  if (!recommendedSlot && freeSlots.length > 0) {
    recommendedSlot = freeSlots[0];
  }

  return {
    date: dateStr,
    events: dayEvents,
    freeSlots,
    recommendedSlot,
    hasConflictWithWorkout,
    conflictDetails,
  };
}

/**
 * Automatically fits a list of workouts into open, conflict-free windows based on calendar commitments.
 */
export function autoFitWorkoutsToFreeSlots(
  workouts: LocalScheduledWorkout[],
  events: ImportedCalendarEvent[],
  preferredPeriod: "morning" | "evening" | "any" = "morning"
): {
  updatedWorkouts: LocalScheduledWorkout[];
  fittedCount: number;
  summaries: string[];
} {
  const summaries: string[] = [];
  let fittedCount = 0;

  const updatedWorkouts = workouts.map((workout) => {
    if (workout.dayType === "rest") return workout;

    const analysis = analyzeDayCalendarAvailability(
      workout.date,
      events,
      workout.durationMinutes,
      workout.scheduledTime
    );

    if (analysis.freeSlots.length === 0) {
      return workout;
    }

    let targetSlot = analysis.freeSlots.find(
      (s) => preferredPeriod === "morning" ? s.label === "Morning Window" : s.label === "Evening Window"
    );
    if (!targetSlot) targetSlot = analysis.recommendedSlot || analysis.freeSlots[0];

    if (targetSlot && targetSlot.start !== workout.scheduledTime) {
      fittedCount++;
      const oldTime = workout.scheduledTime || "08:00";
      const newTime = targetSlot.start;
      summaries.push(
        `${workout.date}: moved from ${oldTime} to ${newTime} (${targetSlot.label})`
      );

      return {
        ...workout,
        scheduledTime: newTime,
        calendarConflict: undefined,
        suggestedFreeSlot: `${targetSlot.start} - ${targetSlot.end} (${targetSlot.label})`,
      };
    }

    return workout;
  });

  return { updatedWorkouts, fittedCount, summaries };
}
