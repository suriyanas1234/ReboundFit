"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalExercise, LocalScheduledWorkout } from "@/lib/db";
import {
  ensureWorkoutSchedule,
  updateScheduledWorkout,
  generateDateRange,
  getMondayOfWeek,
  getSplitWeeklyPattern,
  applyCustomWeeklySchedule,
  ROUTINE_TEMPLATES,
  RoutineTemplate,
} from "@/algorithms/workoutScheduler";
import {
  buildGoogleCalendarUrl,
  generateIcsCalendar,
  downloadIcsFile,
  createGoogleCalendarApiEvent,
  fetchGoogleCalendarEvents,
  getStoredGoogleProviderToken,
  parseIcsContent,
  generateSampleCalendarEvents,
  analyzeDayCalendarAvailability,
  autoFitWorkoutsToFreeSlots,
  ImportedCalendarEvent,
  DayCalendarAnalysis,
  DayFreeSlot,
  CalendarEventPayload,
} from "@/lib/googleCalendar";
import { supabase } from "@/lib/supabase";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Dumbbell,
  Coffee,
  CheckCircle2,
  Clock,
  ExternalLink,
  Download,
  CalendarCheck,
  RefreshCw,
  Edit2,
  Play,
  Layers,
  Check,
  X,
  AlertCircle,
  Sliders,
  Zap,
  Upload,
  CalendarRange,
  Clock3,
  AlertTriangle,
  FileText,
  Info,
  Trash2,
} from "lucide-react";

interface WorkoutScheduleViewProps {
  onStartScheduledWorkout?: (scheduled: LocalScheduledWorkout) => void;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildScheduleConfig(splitType: string = "ppl", frequency: number = 6) {
  const pattern = getSplitWeeklyPattern(splitType, frequency);
  const cfg: {
    [dayOfWeek: number]: {
      dayType: "workout" | "rest";
      routineKey: string;
      preferredTime: string;
    };
  } = {};
  for (let day = 0; day < 7; day++) {
    const template = pattern[day] || ROUTINE_TEMPLATES.rest;
    const key =
      Object.entries(ROUTINE_TEMPLATES).find(([, t]) => t.name === template.name)?.[0] ||
      (template.dayType === "rest" ? "rest" : "push_a");
    cfg[day] = {
      dayType: template.dayType,
      routineKey: key,
      preferredTime: "08:00",
    };
  }
  return cfg;
}

export function WorkoutScheduleView({ onStartScheduledWorkout }: WorkoutScheduleViewProps) {
  const { user, profile, signInWithGoogle, updateProfile } = useAuth();
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<LocalScheduledWorkout[]>([]);
  const [selectedMonday, setSelectedMonday] = useState<string>(() => {
    const today = new Date().toISOString().split("T")[0];
    return getMondayOfWeek(today);
  });
  const [preferredTime, setPreferredTime] = useState<string>("08:00");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingWorkout, setEditingWorkout] = useState<LocalScheduledWorkout | null>(null);

  // Google Calendar Sync & Import States
  const [isSyncingGCal, setIsSyncingGCal] = useState<boolean>(false);
  const [isClearingGCal, setIsClearingGCal] = useState<boolean>(false);
  const [hasGoogleToken, setHasGoogleToken] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = getStoredGoogleProviderToken(session);
      setHasGoogleToken(!!token);
    };
    checkToken();
  }, [user]);

  const handleConnectGoogleCalendar = async () => {
    setIsSyncingGCal(true);
    setSyncStatus(null);
    try {
      const res = await signInWithGoogle();
      if (res?.error) {
        setSyncStatus({
          type: "error",
          message: res.error,
        });
        setIsSyncingGCal(false);
      }
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to initiate Google Calendar connection.",
      });
      setIsSyncingGCal(false);
    }
  };

  // Frequency & Custom Days Modal
  const [isFrequencyModalOpen, setIsFrequencyModalOpen] = useState<boolean>(false);
  const [selectedPresetFrequency, setSelectedPresetFrequency] = useState<number>(() => {
    return profile?.workoutDaysPerWeek || 6;
  });
  const [customDaysConfig, setCustomDaysConfig] = useState<{
    [dayOfWeek: number]: {
      dayType: "workout" | "rest";
      routineKey: string;
      preferredTime: string;
    };
  }>(() => {
    if (profile?.customWeeklySchedule) {
      return profile.customWeeklySchedule as any;
    }
    return buildScheduleConfig(profile?.trainingSplit || "ppl", profile?.workoutDaysPerWeek || 6);
  });

  // Google Calendar Smart Fit & Availability Modal
  const [isCalendarFitModalOpen, setIsCalendarFitModalOpen] = useState<boolean>(false);
  const [importedCalendarEvents, setImportedCalendarEvents] = useState<ImportedCalendarEvent[]>([]);
  const [isImportingGCal, setIsImportingGCal] = useState<boolean>(false);
  const [fitPreferredPeriod, setFitPreferredPeriod] = useState<"morning" | "evening" | "any">("morning");
  const [expandedDayCalendar, setExpandedDayCalendar] = useState<string | null>(null);
  const [autoFitNotice, setAutoFitNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Initialize customDaysConfig & frequency from profile when hydrated
  useEffect(() => {
    if (profile?.customWeeklySchedule) {
      setCustomDaysConfig(profile.customWeeklySchedule as any);
      if (profile.workoutDaysPerWeek) {
        setSelectedPresetFrequency(profile.workoutDaysPerWeek);
      }
    } else if (profile?.workoutDaysPerWeek) {
      setSelectedPresetFrequency(profile.workoutDaysPerWeek);
      setCustomDaysConfig(buildScheduleConfig(profile?.trainingSplit || "ppl", profile.workoutDaysPerWeek));
    }
  }, [profile?.workoutDaysPerWeek, profile?.customWeeklySchedule, profile?.trainingSplit]);

  // Load exercises & current week schedule
  const loadWeekSchedule = async (mondayStr: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const allExercises = await db.exercises.toArray();
      setExercises(allExercises);

      const splitType = (profile?.trainingSplit || "ppl") as any;
      const weekDates = generateDateRange(mondayStr, 7);
      const schedule = await ensureWorkoutSchedule(
        user.id,
        splitType,
        weekDates,
        preferredTime,
        profile?.workoutDaysPerWeek,
        profile?.customWeeklySchedule as any
      );
      setScheduledWorkouts(schedule);
    } catch (err) {
      console.error("Failed to load workout schedule:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWeekSchedule(selectedMonday);
  }, [user, profile, selectedMonday]);

  // Navigate to Prev / Next Week
  const handlePrevWeek = () => {
    const d = new Date(selectedMonday + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setSelectedMonday(d.toISOString().split("T")[0]);
  };

  const handleNextWeek = () => {
    const d = new Date(selectedMonday + "T00:00:00");
    d.setDate(d.getDate() + 7);
    setSelectedMonday(d.toISOString().split("T")[0]);
  };

  const handleJumpToToday = () => {
    const currentMonday = getMondayOfWeek(todayStr);
    setSelectedMonday(currentMonday);
  };

  // Toggle Day Completion
  const handleToggleCompleted = async (workout: LocalScheduledWorkout) => {
    const updated = { ...workout, isCompleted: !workout.isCompleted };
    await updateScheduledWorkout(updated);
    setScheduledWorkouts((prev) =>
      prev.map((item) => (item.id === workout.id ? updated : item))
    );
  };

  // Reschedule Day Type (Workout <-> Rest)
  const handleToggleDayType = async (workout: LocalScheduledWorkout) => {
    const newDayType = workout.dayType === "workout" ? "rest" : "workout";
    const template = newDayType === "rest" ? ROUTINE_TEMPLATES.rest : ROUTINE_TEMPLATES.push_a;
    const updated: LocalScheduledWorkout = {
      ...workout,
      dayType: newDayType,
      routineName: template.name,
      focusMuscleGroups: template.focusMuscleGroups,
      exerciseIds: template.exerciseIds,
      notes: template.description,
    };
    await updateScheduledWorkout(updated);
    setScheduledWorkouts((prev) =>
      prev.map((item) => (item.id === workout.id ? updated : item))
    );
  };

  // Edit Workout Routine
  const handleSaveEdit = async (updated: LocalScheduledWorkout) => {
    await updateScheduledWorkout(updated);
    setScheduledWorkouts((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item))
    );
    setEditingWorkout(null);
  };

  // Helper to get exercise names
  const getExerciseNames = (exerciseIds: string[]) => {
    return exerciseIds
      .map((id) => exercises.find((e) => e.id === id)?.name)
      .filter(Boolean) as string[];
  };

  // 1-Tap Google Calendar Web URL for a single workout
  const handleOpenGoogleCalendarSingle = (workout: LocalScheduledWorkout) => {
    const names = getExerciseNames(workout.exerciseIds);
    const url = buildGoogleCalendarUrl({
      title: workout.routineName,
      date: workout.date,
      time: workout.scheduledTime || preferredTime,
      durationMinutes: workout.durationMinutes,
      details: workout.notes,
      exerciseNames: names,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Sync Whole Week with Google Calendar API or fallback to iCal / web
  const handleSyncWholeWeekGoogleCalendar = async () => {
    setIsSyncingGCal(true);
    setSyncStatus(null);

    const workoutDays = scheduledWorkouts.filter((w) => w.dayType === "workout");
    if (workoutDays.length === 0) {
      setSyncStatus({
        type: "info",
        message: "No workout days scheduled this week to sync.",
      });
      setIsSyncingGCal(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = getStoredGoogleProviderToken(session);

      if (!providerToken) {
        setHasGoogleToken(false);
        setSyncStatus({
          type: "error",
          message: "Please reconnect Google Calendar to grant event access.",
        });
        setIsSyncingGCal(false);
        return;
      }

      // Build event payloads for the API route
      const eventsPayload = workoutDays.map((w) => ({
        workoutId: w.id,
        title: w.routineName,
        date: w.date,
        time: w.scheduledTime || preferredTime,
        durationMinutes: w.durationMinutes,
        details: w.notes,
        exerciseNames: getExerciseNames(w.exerciseIds),
      }));

      // Call API route to authenticate calendar insertions via Google Calendar REST API v3
      const response = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({
          events: eventsPayload,
          providerToken,
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.success) {
        if (
          response.status === 401 ||
          response.status === 403 ||
          resData.error === "INSUFFICIENT_SCOPE" ||
          resData.error === "MISSING_TOKEN" ||
          resData.message?.toLowerCase().includes("reconnect")
        ) {
          setHasGoogleToken(false);
          setSyncStatus({
            type: "error",
            message: "Please reconnect Google Calendar to grant event access.",
          });
          return;
        }

        setSyncStatus({
          type: "error",
          message: resData.message || "Failed to sync with Google Calendar.",
        });
        return;
      }

      setHasGoogleToken(true);

      // Reconcile created event IDs with local scheduled workouts
      if (Array.isArray(resData.results)) {
        for (const res of resData.results) {
          if (res.eventId && res.workoutId) {
            const match = scheduledWorkouts.find((w) => w.id === res.workoutId);
            if (match) {
              await updateScheduledWorkout({ ...match, googleCalendarEventId: res.eventId });
            }
          }
        }
      }

      setSyncStatus({
        type: "success",
        message: `✓ Successfully synced ${resData.syncedCount ?? workoutDays.length} workouts directly to your Google Calendar!`,
      });
    } catch (err: any) {
      if (
        err?.message?.includes("scope") ||
        err?.message?.includes("token") ||
        err?.message?.includes("permission")
      ) {
        setHasGoogleToken(false);
        setSyncStatus({
          type: "error",
          message: "Please reconnect Google Calendar to grant event access.",
        });
      } else {
        setSyncStatus({
          type: "error",
          message: err.message || "Failed to sync with Google Calendar.",
        });
      }
    } finally {
      setIsSyncingGCal(false);
    }
  };

  const handleClearSyncedCalendarEvents = async () => {
    setIsClearingGCal(true);
    setSyncStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = getStoredGoogleProviderToken(session);

      if (!providerToken) {
        setHasGoogleToken(false);
        setSyncStatus({
          type: "error",
          message: "Please reconnect Google Calendar to grant event access.",
        });
        setIsClearingGCal(false);
        return;
      }

      const existingEventIds = scheduledWorkouts
        .map((w) => w.googleCalendarEventId)
        .filter(Boolean) as string[];

      const response = await fetch("/api/calendar/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({
          mondayDate: selectedMonday,
          eventIds: existingEventIds,
          providerToken,
        }),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || !resData.success) {
        if (
          response.status === 401 ||
          response.status === 403 ||
          resData.error === "INSUFFICIENT_SCOPE" ||
          resData.error === "MISSING_TOKEN" ||
          resData.message?.toLowerCase().includes("reconnect")
        ) {
          setHasGoogleToken(false);
          setSyncStatus({
            type: "error",
            message: "Please reconnect Google Calendar to grant event access.",
          });
          return;
        }

        setSyncStatus({
          type: "error",
          message: resData.message || "Failed to clear Google Calendar workouts.",
        });
        return;
      }

      setHasGoogleToken(true);

      // Clean up googleCalendarEventId from all scheduled workouts of this week
      const updatedWeek = scheduledWorkouts.map((w) => {
        if (w.googleCalendarEventId) {
          const cleaned = { ...w, googleCalendarEventId: undefined };
          updateScheduledWorkout(cleaned);
          return cleaned;
        }
        return w;
      });
      setScheduledWorkouts(updatedWeek);

      setSyncStatus({
        type: "success",
        message: "✓ Cleared synced workouts from Google Calendar.",
      });
    } catch (err: any) {
      if (
        err?.message?.includes("scope") ||
        err?.message?.includes("token") ||
        err?.message?.includes("permission")
      ) {
        setHasGoogleToken(false);
        setSyncStatus({
          type: "error",
          message: "Please reconnect Google Calendar to grant event access.",
        });
      } else {
        setSyncStatus({
          type: "error",
          message: err.message || "Failed to clear Google Calendar workouts.",
        });
      }
    } finally {
      setIsClearingGCal(false);
    }
  };

  // =========================================================================
  // FREQUENCY & REST DAYS CUSTOMIZATION HANDLERS
  // =========================================================================
  const handleSelectPreset = (daysPerWeek: number) => {
    setSelectedPresetFrequency(daysPerWeek);
    const pattern = getSplitWeeklyPattern(profile?.trainingSplit || "ppl", daysPerWeek);

    const nextConfig: typeof customDaysConfig = {};
    for (let day = 0; day < 7; day++) {
      const template = pattern[day] || ROUTINE_TEMPLATES.rest;
      const key =
        Object.entries(ROUTINE_TEMPLATES).find(([, t]) => t.name === template.name)?.[0] ||
        (template.dayType === "rest" ? "rest" : "push_a");
      nextConfig[day] = {
        dayType: template.dayType,
        routineKey: key,
        preferredTime: customDaysConfig[day]?.preferredTime || "08:00",
      };
    }
    setCustomDaysConfig(nextConfig);
  };

  const handleToggleMatrixDayType = (day: number) => {
    setCustomDaysConfig((prev) => {
      const current = prev[day];
      const newType = current?.dayType === "workout" ? "rest" : "workout";
      const newKey = newType === "rest" ? "rest" : "push_a";
      return {
        ...prev,
        [day]: {
          dayType: newType,
          routineKey: newKey,
          preferredTime: current?.preferredTime || "08:00",
        },
      };
    });
  };

  const handleUpdateMatrixRoutine = (day: number, routineKey: string) => {
    setCustomDaysConfig((prev) => ({
      ...prev,
      [day]: {
        dayType: routineKey === "rest" ? "rest" : "workout",
        routineKey,
        preferredTime: prev[day]?.preferredTime || "08:00",
      },
    }));
  };

  const handleApplyCustomSchedule = async () => {
    if (!user) return;
    try {
      const pattern: RoutineTemplate[] = [];
      for (let day = 0; day < 7; day++) {
        const cfg = customDaysConfig[day];
        if (cfg && cfg.dayType === "workout" && cfg.routineKey && ROUTINE_TEMPLATES[cfg.routineKey]) {
          pattern.push(ROUTINE_TEMPLATES[cfg.routineKey]);
        } else {
          pattern.push(ROUTINE_TEMPLATES.rest);
        }
      }

      const workoutCount = Object.values(customDaysConfig).filter((c) => c.dayType === "workout").length;

      // 1. Persist directly via updateProfile (optimistic UI + Dexie + localStorage + Supabase Auth user_metadata)
      await updateProfile({
        workoutDaysPerWeek: workoutCount,
        customWeeklySchedule: customDaysConfig,
      });

      // 2. Direct Supabase update mutation for profiles table if present
      try {
        await supabase
          .from("profiles")
          .update({
            workout_days_per_week: workoutCount,
            schedule_preferences: customDaysConfig,
          })
          .eq("id", user.id);
      } catch (sbErr) {
        console.warn("Supabase profiles update notice:", sbErr);
      }

      // 3. Re-apply to current selected week
      const weekDates = generateDateRange(selectedMonday, 7);
      const updatedSchedule = await applyCustomWeeklySchedule(
        user.id,
        weekDates,
        pattern,
        preferredTime
      );
      setScheduledWorkouts(updatedSchedule);

      setIsFrequencyModalOpen(false);
      setSyncStatus({
        type: "success",
        message: `✓ Applied and saved schedule: ${workoutCount} workout days & ${7 - workoutCount} rest days.`,
      });
    } catch (err: any) {
      console.error("Failed to apply custom schedule:", err);
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to save schedule preferences.",
      });
    }
  };

  // =========================================================================
  // GOOGLE CALENDAR AVAILABILITY & SMART FIT HANDLERS
  // =========================================================================
  const handleFetchGoogleCalendarEventsOAuth = async () => {
    setIsImportingGCal(true);
    setAutoFitNotice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = getStoredGoogleProviderToken(session);
      if (!token) {
        setHasGoogleToken(false);
        setSyncStatus({
          type: "error",
          message: "Please reconnect Google Calendar to grant event access.",
        });
        setIsImportingGCal(false);
        return;
      }
      setHasGoogleToken(true);

      const weekDates = generateDateRange(selectedMonday, 7);
      const minIso = `${weekDates[0]}T00:00:00Z`;
      const maxIso = `${weekDates[6]}T23:59:59Z`;

      const res = await fetchGoogleCalendarEvents(token, minIso, maxIso);
      if (res.success && res.events) {
        setImportedCalendarEvents(res.events);
        setAutoFitNotice(`✓ Imported ${res.events.length} Google Calendar commitments for this week!`);
      } else {
        if (
          res.error?.includes("401") ||
          res.error?.includes("403") ||
          res.error?.toLowerCase().includes("permission") ||
          res.error?.toLowerCase().includes("scope")
        ) {
          setHasGoogleToken(false);
          setSyncStatus({
            type: "error",
            message: "Please reconnect Google Calendar to grant event access.",
          });
        } else {
          setSyncStatus({
            type: "error",
            message: res.error || "Could not retrieve Google Calendar events.",
          });
        }
      }
    } catch (err: any) {
      setHasGoogleToken(false);
      setSyncStatus({ type: "error", message: "Please reconnect Google Calendar to grant event access." });
    } finally {
      setIsImportingGCal(false);
    }
  };

  const handleUploadIcsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const events = parseIcsContent(content);
        setImportedCalendarEvents(events);
        setAutoFitNotice(`✓ Loaded ${events.length} calendar events from ${file.name}!`);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadSampleSchedule = () => {
    const sample = generateSampleCalendarEvents(selectedMonday);
    setImportedCalendarEvents(sample);
    setAutoFitNotice("✓ Loaded sample calendar schedule (meetings, standups & appointments).");
  };

  const handleAutoFitWorkouts = async () => {
    if (importedCalendarEvents.length === 0) {
      setAutoFitNotice("Please import or load calendar commitments first to detect free windows.");
      return;
    }

    const { updatedWorkouts, fittedCount, summaries } = autoFitWorkoutsToFreeSlots(
      scheduledWorkouts,
      importedCalendarEvents,
      fitPreferredPeriod
    );

    for (const w of updatedWorkouts) {
      await updateScheduledWorkout(w);
    }
    setScheduledWorkouts(updatedWorkouts);

    setAutoFitNotice(
      fittedCount > 0
        ? `⚡ Successfully auto-fitted ${fittedCount} workouts into conflict-free windows!`
        : "✓ All scheduled workouts already fit your calendar commitments with 0 conflicts!"
    );
  };

  const handleApplySingleFreeSlot = async (workout: LocalScheduledWorkout, slotStart: string) => {
    const updated: LocalScheduledWorkout = {
      ...workout,
      scheduledTime: slotStart,
      calendarConflict: undefined,
      suggestedFreeSlot: `${slotStart} (Manual Fit)`,
      updatedAt: new Date().toISOString(),
    };
    await updateScheduledWorkout(updated);
    setScheduledWorkouts((prev) => prev.map((w) => (w.id === workout.id ? updated : w)));
  };

  // Helper date formatting
  const formatHeaderRange = (mondayStr: string) => {
    const start = new Date(mondayStr + "T00:00:00");
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const startMonth = start.toLocaleDateString("en-US", { month: "short" });
    const startDay = start.getDate();
    const endMonth = end.toLocaleDateString("en-US", { month: "short" });
    const endDay = end.getDate();
    const year = end.getFullYear();

    return startMonth === endMonth
      ? `${startMonth} ${startDay} – ${endDay}, ${year}`
      : `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  };

  const getDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short" });
  };

  const getFormattedDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Count active workout and rest days currently configured
  const currentWorkoutDaysCount = Object.values(customDaysConfig).filter(
    (c) => c.dayType === "workout"
  ).length;
  const currentRestDaysCount = 7 - currentWorkoutDaysCount;

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BANNER: DATE NAVIGATION, FREQUENCY & GOOGLE CALENDAR CONTROLS
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 flex-wrap">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-cyan">
              {currentWorkoutDaysCount} Days / Week • {currentRestDaysCount} Rest Days
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-mono">
              {profile?.trainingSplit?.toUpperCase() || "PPL"} Split
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            {formatHeaderRange(selectedMonday)}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Choose your workout vs rest days, check calendar conflicts, and auto-fit sessions into free windows.
          </p>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selector */}
          <div className="flex items-center rounded-full bg-[#1C1C1E] border border-neutral-800/60 p-1 shadow-sm">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-[#2C2C2E] transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1 rounded-full text-xs font-medium text-neutral-300 hover:text-white hover:bg-[#2C2C2E] transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-[#2C2C2E] transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Change Workout Frequency / Rest Days */}
          <button
            onClick={() => setIsFrequencyModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-neutral-800/60 text-xs font-medium text-neutral-300 hover:text-white transition-all active:scale-95 shadow-sm"
            title="Configure how many days you work out and have rest days"
          >
            <Sliders className="w-3.5 h-3.5 text-neutral-400" />
            <span>Workout & Rest Days</span>
          </button>

          {/* Google Calendar Smart Fit */}
          <button
            onClick={() => setIsCalendarFitModalOpen(true)}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-neutral-800/60 text-xs font-medium text-neutral-300 hover:text-white transition-all active:scale-95 shadow-sm"
            title="Import Google Calendar and see where workouts fit"
          >
            <Zap className="w-3.5 h-3.5 text-[#FF9500]" />
            <span>Calendar Availability & Fit</span>
          </button>

          {/* Connect Google Calendar (if not yet authorized) or Connected Badge */}
          {!hasGoogleToken ? (
            <button
              onClick={handleConnectGoogleCalendar}
              disabled={isSyncingGCal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-neutral-800/60 text-xs font-medium text-[#0A84FF] transition-all active:scale-95 shadow-sm disabled:opacity-50"
              title="Connect Google Calendar for direct 1-tap sync and availability checks"
            >
              <Calendar className="w-3.5 h-3.5 text-[#0A84FF]" />
              <span>Connect Google Cal</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1C1C1E] border border-neutral-800/60 text-xs font-medium text-neutral-300 shadow-sm">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#30D158]" />
              <span>Google Cal Connected</span>
            </div>
          )}

          {/* Sync Week with Google Calendar */}
          <button
            onClick={handleSyncWholeWeekGoogleCalendar}
            disabled={isSyncingGCal || isClearingGCal}
            className="flex items-center space-x-2 px-4 py-2 rounded-full bg-[#0A84FF] hover:bg-[#0071E3] text-white font-semibold text-xs active:scale-95 disabled:opacity-50 transition-all shadow-sm"
          >
            {isSyncingGCal ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CalendarCheck className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
            <span>{isSyncingGCal ? "Syncing..." : "Sync Week to Google Cal"}</span>
          </button>

          {/* Clear / Remove Synced Calendar Events */}
          <button
            onClick={handleClearSyncedCalendarEvents}
            disabled={isSyncingGCal || isClearingGCal}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-xs font-medium text-red-400 hover:text-red-300 active:scale-95 disabled:opacity-50 transition-all shadow-sm"
            title="Clear ReboundFit workouts from Google Calendar for this week"
          >
            {isClearingGCal ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>{isClearingGCal ? "Clearing..." : "Clear Cal Week"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs border ${
            syncStatus.type === "success"
              ? "bg-[#30D158]/10 border-[#30D158]/20 text-[#30D158]"
              : syncStatus.type === "error"
              ? "bg-[#FF453A]/10 border-[#FF453A]/20 text-[#FF453A]"
              : "bg-[#0A84FF]/10 border-[#0A84FF]/20 text-[#0A84FF]"
          }`}
        >
          <div className="flex items-center space-x-2">
            {syncStatus.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-[#30D158]" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-medium leading-relaxed">{syncStatus.message}</span>
          </div>
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {!hasGoogleToken && (
              <button
                type="button"
                onClick={handleConnectGoogleCalendar}
                className="px-3.5 py-1.5 rounded-full bg-[#0A84FF] hover:bg-[#0071E3] text-white font-semibold text-xs shadow-sm active:scale-95 transition-all whitespace-nowrap"
              >
                Connect Google Calendar
              </button>
            )}
            <button
              onClick={() => setSyncStatus(null)}
              className="text-neutral-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SCHEDULE QUICK BAR: 7-DAY TIMELINE
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {scheduledWorkouts.map((workout) => {
          const isToday = workout.date === todayStr;
          const isRest = workout.dayType === "rest";

          // Calculate calendar analysis if events imported
          const analysis =
            importedCalendarEvents.length > 0
              ? analyzeDayCalendarAvailability(
                  workout.date,
                  importedCalendarEvents,
                  workout.durationMinutes,
                  workout.scheduledTime
                )
              : null;

          return (
            <div
              key={workout.id}
              className={`p-3 rounded-2xl border text-center transition-all ${
                isToday
                  ? "bg-brand-cyan/15 border-brand-cyan ring-1 ring-brand-cyan shadow-lg shadow-brand-cyan/10"
                  : isRest
                  ? "bg-surface/50 border-surface-border text-gray-400"
                  : workout.isCompleted
                  ? "bg-brand-emerald/10 border-brand-emerald/40 text-white"
                  : "bg-surface border-surface-border text-white hover:border-brand-cyan/40"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 mb-1">
                <span className="font-bold">{getDayLabel(workout.date)}</span>
                <span>{getFormattedDate(workout.date)}</span>
              </div>

              <div className="font-bold text-xs truncate mb-1">
                {isRest ? "Rest Day" : workout.routineName.split("(")[0]}
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-center space-x-1">
                {workout.isCompleted ? (
                  <span className="text-[10px] font-mono text-brand-emerald flex items-center space-x-0.5">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Done</span>
                  </span>
                ) : isRest ? (
                  <span className="text-[10px] font-mono text-amber-400/80 flex items-center space-x-0.5">
                    <Coffee className="w-3 h-3" />
                    <span>Recovery</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-brand-cyan flex items-center space-x-0.5">
                    <Clock className="w-3 h-3" />
                    <span>{workout.scheduledTime || "08:00"}</span>
                  </span>
                )}
              </div>

              {/* Conflict indicator on mini card if detected */}
              {analysis?.hasConflictWithWorkout && (
                <div className="mt-1 text-[9px] font-bold text-brand-rose bg-brand-rose/15 rounded py-0.5 px-1 truncate">
                  Conflict!
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          DETAILED DATE-BY-DATE WORKOUT CARDS
          ========================================================================= */}
      <div className="space-y-4">
        {scheduledWorkouts.map((workout) => {
          const isToday = workout.date === todayStr;
          const isRest = workout.dayType === "rest";
          const exerciseNames = getExerciseNames(workout.exerciseIds);

          // Real-time Calendar Conflict & Free Window Analysis
          const analysis =
            importedCalendarEvents.length > 0
              ? analyzeDayCalendarAvailability(
                  workout.date,
                  importedCalendarEvents,
                  workout.durationMinutes,
                  workout.scheduledTime
                )
              : null;

          return (
            <div
              key={workout.id}
              className={`rounded-3xl border p-6 transition-all shadow-xl ${
                isToday
                  ? "bg-surface border-brand-cyan/60 ring-1 ring-brand-cyan/40"
                  : isRest
                  ? "bg-surface/60 border-surface-border opacity-90"
                  : "bg-surface border-surface-border hover:border-surface-border/80"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Day Header & Routine */}
                <div className="space-y-2 flex-1">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <span className="px-3 py-1 rounded-xl bg-surface-elevated border border-surface-border text-xs font-mono font-bold text-white">
                      {getDayLabel(workout.date)}, {getFormattedDate(workout.date)}
                    </span>

                    {isToday && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-[11px] font-mono font-bold uppercase">
                        Today
                      </span>
                    )}

                    {workout.isCompleted && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-emerald/20 border border-brand-emerald/40 text-brand-emerald text-[11px] font-mono font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Completed</span>
                      </span>
                    )}

                    {/* Google Calendar Conflict Warning or Free Slot Badge */}
                    {analysis?.hasConflictWithWorkout && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-rose/20 border border-brand-rose/40 text-brand-rose text-[11px] font-mono font-bold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Calendar Conflict</span>
                      </span>
                    )}

                    {analysis && !analysis.hasConflictWithWorkout && !isRest && (
                      <span className="px-2.5 py-0.5 rounded-full bg-brand-emerald/15 border border-brand-emerald/30 text-brand-emerald text-[11px] font-mono flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Fits Calendar</span>
                      </span>
                    )}
                  </div>

                  {/* Title & Notes */}
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center space-x-2">
                      <span>{workout.routineName}</span>
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {workout.notes ||
                        (isRest
                          ? "Recovery day for muscle protein synthesis and energy replenishment."
                          : "Targeted progressive overload training session.")}
                    </p>
                  </div>

                  {/* Meta Chips */}
                  <div className="flex items-center space-x-3 text-xs font-mono text-gray-400 pt-1 flex-wrap gap-y-1">
                    {!isRest && (
                      <>
                        <div className="flex items-center space-x-1 text-gray-300">
                          <Clock className="w-3.5 h-3.5 text-brand-cyan" />
                          <span>Time: {workout.scheduledTime || "08:00"}</span>
                        </div>
                        <span>•</span>
                        <div>~{workout.durationMinutes || 60} min session</div>
                        <span>•</span>
                      </>
                    )}

                    {workout.focusMuscleGroups && workout.focusMuscleGroups.length > 0 && (
                      <div className="flex items-center space-x-1">
                        {workout.focusMuscleGroups.map((m) => (
                          <span
                            key={m}
                            className="px-2 py-0.5 rounded bg-surface-elevated text-[10px] uppercase text-gray-300"
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calendar Conflict Alert Message with 1-click Quick Fix */}
                  {analysis?.hasConflictWithWorkout && (
                    <div className="mt-2 p-3 rounded-2xl bg-brand-rose/10 border border-brand-rose/30 flex items-center justify-between text-xs text-brand-rose">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{analysis.conflictDetails}</span>
                      </div>
                      {analysis.recommendedSlot && (
                        <button
                          onClick={() => handleApplySingleFreeSlot(workout, analysis.recommendedSlot!.start)}
                          className="px-3 py-1 rounded-xl bg-brand-rose/20 hover:bg-brand-rose/30 text-[11px] font-bold text-white transition-colors"
                        >
                          Auto-Fix to {analysis.recommendedSlot.start}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Imported Calendar Commitments Expandable */}
                  {analysis && analysis.events.length > 0 && (
                    <div className="pt-1">
                      <button
                        onClick={() =>
                          setExpandedDayCalendar(
                            expandedDayCalendar === workout.date ? null : workout.date
                          )
                        }
                        className="text-xs text-brand-cyan hover:underline flex items-center space-x-1 font-mono"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {analysis.events.length} Google Calendar commitment(s) today{" "}
                          {expandedDayCalendar === workout.date ? "▲" : "▼"}
                        </span>
                      </button>

                      {expandedDayCalendar === workout.date && (
                        <div className="mt-2 p-3 rounded-2xl bg-surface-elevated/70 border border-surface-border text-xs space-y-2">
                          <div className="text-[11px] font-mono uppercase text-gray-400">
                            Your Calendar Commitments:
                          </div>
                          {analysis.events.map((ev) => (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between text-gray-300"
                            >
                              <span className="font-semibold text-white truncate">{ev.title}</span>
                              <span className="font-mono text-gray-400">
                                {ev.isAllDay ? "All Day" : `${ev.startTime} - ${ev.endTime}`}
                              </span>
                            </div>
                          ))}

                          <div className="pt-2 border-t border-surface-border">
                            <div className="text-[11px] font-mono uppercase text-brand-emerald mb-1">
                              Detected Free Workout Windows:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {analysis.freeSlots.map((slot, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleApplySingleFreeSlot(workout, slot.start)}
                                  className="px-2.5 py-1 rounded-xl bg-surface hover:bg-brand-cyan/20 border border-surface-border hover:border-brand-cyan/40 text-[11px] text-gray-200 hover:text-white transition-colors font-mono"
                                  title="Fit workout to this free window"
                                >
                                  {slot.start} – {slot.end} ({slot.label}) ⚡ Fit
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Exercise Checklist Preview */}
                  {!isRest && exerciseNames.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-mono uppercase text-gray-500 mb-1">
                        Planned Exercises:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {exerciseNames.map((name, i) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated/80 border border-surface-border text-xs text-gray-300 flex items-center space-x-1"
                          >
                            <span className="text-[10px] font-mono text-brand-cyan">#{i + 1}</span>
                            <span>{name}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex flex-wrap sm:flex-col items-end gap-2 flex-shrink-0">
                  {/* Start Workout Button */}
                  {!isRest && (
                    <button
                      onClick={() => onStartScheduledWorkout && onStartScheduledWorkout(workout)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-brand-cyan hover:bg-brand-cyan/90 text-black font-extrabold text-xs flex items-center justify-center space-x-1.5 shadow-md shadow-brand-cyan/20 active:scale-95 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Workout</span>
                    </button>
                  )}

                  {/* 1-Tap Google Calendar Web Intent */}
                  {!isRest && (
                    <button
                      onClick={() => handleOpenGoogleCalendarSingle(workout)}
                      className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border hover:border-brand-cyan/40 text-xs font-semibold text-gray-200 hover:text-white flex items-center justify-center space-x-1.5 transition-colors"
                      title="Add this workout to Google Calendar"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>Add to Google Cal</span>
                    </button>
                  )}

                  {/* Secondary Toggles */}
                  <div className="flex items-center space-x-1.5 w-full sm:w-auto justify-end pt-1">
                    <button
                      onClick={() => handleToggleCompleted(workout)}
                      className={`p-2 rounded-xl border text-xs transition-colors ${
                        workout.isCompleted
                          ? "bg-brand-emerald text-black border-brand-emerald"
                          : "bg-surface-elevated border-surface-border text-gray-400 hover:text-white"
                      }`}
                      title={workout.isCompleted ? "Mark Incomplete" : "Mark Complete"}
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                    </button>

                    <button
                      onClick={() => handleToggleDayType(workout)}
                      className="px-2.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-xs text-gray-400 hover:text-white transition-colors"
                      title={isRest ? "Change to Workout" : "Change to Rest"}
                    >
                      {isRest ? "Make Workout" : "Make Rest"}
                    </button>

                    <button
                      onClick={() => setEditingWorkout(workout)}
                      className="p-2 rounded-xl bg-surface-elevated border border-surface-border text-gray-400 hover:text-white transition-colors"
                      title="Edit routine details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          MODAL 1: CUSTOMIZE WORKOUT FREQUENCY & REST DAYS
          ========================================================================= */}
      {isFrequencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <div className="flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-brand-cyan" />
                  <h3 className="text-lg font-bold text-white">Customize Workout & Rest Days</h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Select how many days you want to train and choose which days are rest days.
                </p>
              </div>
              <button
                onClick={() => setIsFrequencyModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Frequency Presets */}
            <div>
              <label className="text-xs font-mono uppercase text-gray-400 block mb-2">
                Quick Frequency Presets:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { days: 3, label: "3 Days / Week", desc: "Full Body (Mon/Wed/Fri)" },
                  { days: 4, label: "4 Days / Week", desc: "Upper / Lower (Mon/Tue/Thu/Fri)" },
                  { days: 5, label: "5 Days / Week", desc: "PPL + Upper/Lower" },
                  { days: 6, label: "6 Days / Week", desc: "Classic PPL (1 Rest Day)" },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => handleSelectPreset(preset.days)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      selectedPresetFrequency === preset.days
                        ? "bg-[#0A84FF]/15 border-[#0A84FF] text-white shadow-sm"
                        : "bg-[#1C1C1E] border-neutral-800/80 text-neutral-300 hover:border-neutral-600"
                    }`}
                  >
                    <div className="font-bold text-xs">{preset.label}</div>
                    <div className="text-[10px] text-neutral-400 mt-0.5">{preset.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 7-Day Day-by-Day Interactive Matrix */}
            <div className="space-y-2 overflow-y-auto pr-1 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-neutral-400 uppercase">
                  Weekly Schedule Matrix (Click to toggle Workout vs Rest):
                </span>
                <span className="font-mono font-bold text-[#0A84FF]">
                  {currentWorkoutDaysCount} Workout Days • {currentRestDaysCount} Rest Days
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                  const cfg = customDaysConfig[dayIdx] || {
                    dayType: "rest",
                    routineKey: "rest",
                    preferredTime: "08:00",
                  };
                  const isWorkout = cfg.dayType === "workout";

                  return (
                    <div
                      key={dayIdx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isWorkout
                          ? "bg-[#1C1C1E] border-neutral-800/80"
                          : "bg-[#1C1C1E]/50 border-neutral-800/40 text-neutral-400"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">
                          {DAY_NAMES[dayIdx]} ({DAY_SHORT_NAMES[dayIdx]})
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleMatrixDayType(dayIdx)}
                          className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${
                            isWorkout
                              ? "bg-[#0A84FF] text-white shadow-sm"
                              : "bg-[#2C2C2E] text-neutral-400 border border-neutral-700/60"
                          }`}
                        >
                          {isWorkout ? "Workout" : "Rest Day"}
                        </button>
                      </div>

                      {isWorkout ? (
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-mono text-neutral-400">Assigned Routine:</label>
                          <select
                            value={cfg.routineKey}
                            onChange={(e) => handleUpdateMatrixRoutine(dayIdx, e.target.value)}
                            className="w-full bg-[#2C2C2E] border border-neutral-700/60 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#0A84FF]"
                          >
                            {Object.entries(ROUTINE_TEMPLATES).map(([k, t]) => (
                              <option key={k} value={k} className="bg-[#1C1C1E]">
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div className="text-[11px] font-mono text-neutral-500 italic py-1">
                          Active recovery, caloric maintenance, and rest.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-neutral-800/80">
              <button
                type="button"
                onClick={() => setIsFrequencyModalOpen(false)}
                className="px-4 py-2 rounded-full text-xs font-semibold text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyCustomSchedule}
                className="px-5 py-2.5 rounded-full bg-[#0A84FF] hover:bg-[#0071E3] text-white font-semibold text-xs active:scale-95 transition-all shadow-sm"
              >
                Apply & Save Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: GOOGLE CALENDAR AVAILABILITY & SMART FIT
          ========================================================================= */}
      {isCalendarFitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl space-y-5 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-bold text-white">
                    Google Calendar Availability & Smart Fit
                  </h3>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  Import your Google Calendar to view commitments and auto-fit workouts into free windows.
                </p>
              </div>
              <button
                onClick={() => setIsCalendarFitModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Step 1: Import Google Calendar Events */}
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-gray-400 block">
                1. Sync / Import Your Google Calendar:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Option A: OAuth Direct Sync / Connect */}
                {!hasGoogleToken ? (
                  <button
                    type="button"
                    onClick={handleConnectGoogleCalendar}
                    className="p-3 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/40 hover:bg-brand-cyan/20 text-left transition-all active:scale-95"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-brand-cyan">
                      <Calendar className="w-3.5 h-3.5 text-brand-cyan" />
                      <span>Connect Google Cal</span>
                    </div>
                    <div className="text-[10px] text-gray-300 mt-1">
                      Authorize Google account access.
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFetchGoogleCalendarEventsOAuth}
                    disabled={isImportingGCal}
                    className="p-3 rounded-2xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/50 text-left transition-all active:scale-95 disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-brand-cyan">
                      <RefreshCw className={`w-3.5 h-3.5 ${isImportingGCal ? "animate-spin" : ""}`} />
                      <span>Fetch Google Events</span>
                    </div>
                    <div className="text-[10px] text-emerald-400 mt-1">
                      ✓ Connected. Load commitments.
                    </div>
                  </button>
                )}

                {/* Option B: Upload .ics file */}
                <label className="p-3 rounded-2xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/50 text-left transition-all active:scale-95 cursor-pointer">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-white">
                    <Upload className="w-3.5 h-3.5 text-brand-emerald" />
                    <span>Upload .ics File</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Export from Google Cal & upload.
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleUploadIcsFile}
                    className="sr-only"
                  />
                </label>

                {/* Option C: Load Sample Schedule */}
                <button
                  type="button"
                  onClick={handleLoadSampleSchedule}
                  className="p-3 rounded-2xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/50 text-left transition-all active:scale-95"
                >
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                    <CalendarRange className="w-3.5 h-3.5" />
                    <span>Demo Schedule</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    Test smart slot detection with sample meetings.
                  </div>
                </button>
              </div>
            </div>

            {/* Notification / Status */}
            {autoFitNotice && (
              <div className="p-3 rounded-2xl bg-brand-cyan/10 border border-brand-cyan/30 text-xs text-brand-cyan flex items-center space-x-2">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>{autoFitNotice}</span>
              </div>
            )}

            {/* Step 2: Auto-Fit Configuration */}
            <div className="p-4 rounded-2xl bg-surface-elevated border border-surface-border space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-xs font-bold text-white">2. Fit Workouts to Free Windows</div>
                  <div className="text-[11px] text-gray-400">
                    {importedCalendarEvents.length} calendar commitments currently loaded.
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono text-gray-400">Preferred Window:</span>
                  <select
                    value={fitPreferredPeriod}
                    onChange={(e) => setFitPreferredPeriod(e.target.value as any)}
                    className="bg-surface border border-surface-border rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-brand-cyan"
                  >
                    <option value="morning">Morning (06:00 – 12:00)</option>
                    <option value="evening">Evening (17:00 – 22:00)</option>
                    <option value="any">Any Available Window</option>
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoFitWorkouts}
                disabled={importedCalendarEvents.length === 0}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-brand-cyan text-black font-extrabold text-xs shadow-md shadow-brand-cyan/10 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Auto-Fit All Workouts to Open Windows</span>
              </button>
            </div>

            {/* Step 3: Breakdown by Day */}
            <div className="overflow-y-auto space-y-2 pr-1 flex-1">
              <span className="text-xs font-mono uppercase text-gray-400 block">
                3. Day-by-Day Calendar Free Windows:
              </span>

              {scheduledWorkouts.map((workout) => {
                const analysis = analyzeDayCalendarAvailability(
                  workout.date,
                  importedCalendarEvents,
                  workout.durationMinutes,
                  workout.scheduledTime
                );

                return (
                  <div
                    key={workout.id}
                    className="p-3 rounded-2xl bg-surface-elevated border border-surface-border text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white">
                          {getDayLabel(workout.date)} ({workout.date})
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="text-gray-300 truncate max-w-[200px]">
                          {workout.routineName}
                        </span>
                      </div>

                      <span className="font-mono text-brand-cyan">
                        Workout Time: {workout.scheduledTime || "08:00"}
                      </span>
                    </div>

                    {/* Commitments summary */}
                    <div className="text-[11px] text-gray-400 font-mono">
                      {analysis.events.length > 0 ? (
                        <span>
                          {analysis.events.length} event(s):{" "}
                          {analysis.events.map((e) => e.title).join(", ")}
                        </span>
                      ) : (
                        <span>No calendar commitments (Whole day free)</span>
                      )}
                    </div>

                    {/* Conflict Alert */}
                    {analysis.hasConflictWithWorkout && (
                      <div className="text-[11px] font-bold text-brand-rose flex items-center space-x-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>{analysis.conflictDetails}</span>
                      </div>
                    )}

                    {/* Free Slots */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-mono text-gray-400">Available Windows:</span>
                      {analysis.freeSlots.map((slot, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleApplySingleFreeSlot(workout, slot.start)}
                          className="px-2 py-0.5 rounded-lg bg-surface hover:bg-brand-cyan/20 border border-surface-border hover:border-brand-cyan/40 text-[10px] text-gray-300 hover:text-white font-mono transition-colors"
                        >
                          {slot.start} – {slot.end} ({slot.label})
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-end pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setIsCalendarFitModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border text-xs font-bold text-white transition-colors"
              >
                Close & Review Schedule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: EDIT SCHEDULED WORKOUT ROUTINE DETAILS
          ========================================================================= */}
      {editingWorkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-border">
              <div>
                <h3 className="text-lg font-bold text-white">Edit Scheduled Workout</h3>
                <p className="text-xs text-gray-400 font-mono">
                  {getFormattedDate(editingWorkout.date)} • {editingWorkout.date}
                </p>
              </div>
              <button
                onClick={() => setEditingWorkout(null)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface-elevated"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Routine Name */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Workout Title
                </label>
                <input
                  type="text"
                  value={editingWorkout.routineName}
                  onChange={(e) =>
                    setEditingWorkout({ ...editingWorkout, routineName: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
                />
              </div>

              {/* Scheduled Time & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    value={editingWorkout.scheduledTime || "08:00"}
                    onChange={(e) =>
                      setEditingWorkout({ ...editingWorkout, scheduledTime: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 block mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={editingWorkout.durationMinutes || 60}
                    onChange={(e) =>
                      setEditingWorkout({
                        ...editingWorkout,
                        durationMinutes: parseInt(e.target.value) || 60,
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
                  />
                </div>
              </div>

              {/* Template Quick Select */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Preset Routine Templates
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                  {Object.entries(ROUTINE_TEMPLATES).map(([key, t]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() =>
                        setEditingWorkout({
                          ...editingWorkout,
                          routineName: t.name,
                          dayType: t.dayType,
                          focusMuscleGroups: t.focusMuscleGroups,
                          exerciseIds: t.exerciseIds,
                          durationMinutes: t.defaultDurationMinutes || 60,
                          notes: t.description,
                        })
                      }
                      className="p-2.5 rounded-xl text-left text-xs bg-surface-elevated border border-surface-border hover:border-brand-cyan/40 transition-colors"
                    >
                      <div className="font-bold text-white truncate">{t.name.split("(")[0]}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-mono mt-0.5">
                        {t.dayType}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="text-xs font-semibold text-gray-300 block mb-1">
                  Notes / Focus
                </label>
                <textarea
                  rows={2}
                  value={editingWorkout.notes || ""}
                  onChange={(e) =>
                    setEditingWorkout({ ...editingWorkout, notes: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-xs text-white focus:outline-none focus:border-brand-cyan"
                  placeholder="Specific compound focus, warm-up reminders, or rest goals..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-surface-border">
              <button
                type="button"
                onClick={() => setEditingWorkout(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(editingWorkout)}
                className="px-5 py-2.5 rounded-xl bg-brand-cyan text-black font-extrabold text-xs shadow-md shadow-brand-cyan/20 active:scale-95 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
