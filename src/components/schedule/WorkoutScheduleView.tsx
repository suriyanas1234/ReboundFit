"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalExercise, LocalScheduledWorkout } from "@/lib/db";
import {
  ensureWorkoutSchedule,
  updateScheduledWorkout,
  generateDateRange,
  getMondayOfWeek,
  ROUTINE_TEMPLATES,
  RoutineTemplate,
} from "@/algorithms/workoutScheduler";
import {
  buildGoogleCalendarUrl,
  generateIcsCalendar,
  downloadIcsFile,
  createGoogleCalendarApiEvent,
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
} from "lucide-react";

interface WorkoutScheduleViewProps {
  onStartScheduledWorkout?: (scheduled: LocalScheduledWorkout) => void;
}

export function WorkoutScheduleView({ onStartScheduledWorkout }: WorkoutScheduleViewProps) {
  const { user, profile } = useAuth();
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<LocalScheduledWorkout[]>([]);
  const [selectedMonday, setSelectedMonday] = useState<string>(() => {
    const today = new Date().toISOString().split("T")[0];
    return getMondayOfWeek(today);
  });
  const [preferredTime, setPreferredTime] = useState<string>("08:00");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [editingWorkout, setEditingWorkout] = useState<LocalScheduledWorkout | null>(null);

  // Google Calendar Sync States
  const [isSyncingGCal, setIsSyncingGCal] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  // Load exercises & current week schedule
  const loadWeekSchedule = async (mondayStr: string) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const allExercises = await db.exercises.toArray();
      setExercises(allExercises);

      const splitType = (profile?.trainingSplit || "ppl") as any;
      const weekDates = generateDateRange(mondayStr, 7);
      const schedule = await ensureWorkoutSchedule(user.id, splitType, weekDates, preferredTime);
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
      // 1. Check if Supabase session has an active Google OAuth provider_token
      const { data: { session } } = await supabase.auth.getSession();
      const providerToken = session?.provider_token;

      if (providerToken) {
        // Direct Google Calendar API sync
        let successCount = 0;
        for (const w of workoutDays) {
          const names = getExerciseNames(w.exerciseIds);
          const payload: CalendarEventPayload = {
            title: w.routineName,
            date: w.date,
            time: w.scheduledTime || preferredTime,
            durationMinutes: w.durationMinutes,
            details: w.notes,
            exerciseNames: names,
          };
          const res = await createGoogleCalendarApiEvent(providerToken, payload);
          if (res.success) {
            successCount++;
            if (res.eventId) {
              await updateScheduledWorkout({ ...w, googleCalendarEventId: res.eventId });
            }
          }
        }

        setSyncStatus({
          type: "success",
          message: `✓ Successfully synced ${successCount} workouts directly to your Google Calendar!`,
        });
      } else {
        // Fallback: Generate full week .ics Calendar file download & offer instant web link
        const payloads: CalendarEventPayload[] = workoutDays.map((w) => ({
          title: w.routineName,
          date: w.date,
          time: w.scheduledTime || preferredTime,
          durationMinutes: w.durationMinutes,
          details: w.notes,
          exerciseNames: getExerciseNames(w.exerciseIds),
        }));

        const icsContent = generateIcsCalendar(payloads);
        downloadIcsFile(`reboundfit-week-${selectedMonday}.ics`, icsContent);

        setSyncStatus({
          type: "success",
          message: "✓ Generated & downloaded Google Calendar schedule (.ics). Open it or import to Google Calendar!",
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: "error",
        message: err.message || "Failed to sync with Google Calendar.",
      });
    } finally {
      setIsSyncingGCal(false);
    }
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

  return (
    <div className="space-y-6">
      {/* =========================================================================
          TOP BANNER: DATE NAVIGATION & GOOGLE CALENDAR SYNC LAUNCHER
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-brand-cyan">
              Training Split: {profile?.trainingSplit?.toUpperCase() || "PPL"}
            </span>
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400 font-mono">Date-By-Date Schedule</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1">
            {formatHeaderRange(selectedMonday)}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Plan your workouts by date, adjust session times, and sync directly with Google Calendar.
          </p>
        </div>

        {/* Action Controls & Navigation */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Selector buttons */}
          <div className="flex items-center rounded-2xl bg-surface-elevated border border-surface-border p-1">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-gray-300 hover:text-white hover:bg-surface transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-surface transition-colors"
              title="Next Week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Sync Week with Google Calendar */}
          <button
            onClick={handleSyncWholeWeekGoogleCalendar}
            disabled={isSyncingGCal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-brand-cyan to-brand-emerald text-black font-extrabold text-xs shadow-lg shadow-brand-cyan/20 active:scale-95 disabled:opacity-50 transition-all"
          >
            {isSyncingGCal ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <CalendarCheck className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>{isSyncingGCal ? "Syncing..." : "Sync with Google Calendar"}</span>
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncStatus && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between text-xs border ${
            syncStatus.type === "success"
              ? "bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald"
              : syncStatus.type === "error"
              ? "bg-brand-rose/10 border-brand-rose/30 text-brand-rose"
              : "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan"
          }`}
        >
          <div className="flex items-center space-x-2">
            {syncStatus.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="font-medium">{syncStatus.message}</span>
          </div>
          <button
            onClick={() => setSyncStatus(null)}
            className="text-gray-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* =========================================================================
          SCHEDULE QUICK BAR: 7-DAY TIMELINE
          ========================================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {scheduledWorkouts.map((workout) => {
          const isToday = workout.date === todayStr;
          const isRest = workout.dayType === "rest";

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
              <div className="text-[10px] font-mono uppercase text-gray-400">
                {getDayLabel(workout.date)}
              </div>
              <div className={`text-sm font-bold ${isToday ? "text-brand-cyan" : "text-white"}`}>
                {getFormattedDate(workout.date)}
              </div>
              <div className="mt-2 text-[11px] font-semibold truncate" title={workout.routineName}>
                {isRest ? "Rest Day" : workout.routineName.split("(")[0].trim()}
              </div>
              <div className="mt-1 flex items-center justify-center">
                {workout.isCompleted ? (
                  <span className="inline-flex items-center space-x-1 text-[10px] text-brand-emerald font-mono">
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </span>
                ) : isRest ? (
                  <span className="text-[10px] text-gray-500 font-mono">Recovery</span>
                ) : (
                  <span className="text-[10px] text-brand-cyan font-mono">Scheduled</span>
                )}
              </div>
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
          const plannedNames = getExerciseNames(workout.exerciseIds);

          return (
            <div
              key={workout.id}
              className={`rounded-3xl p-6 border transition-all ${
                isToday
                  ? "bg-surface border-brand-cyan/60 shadow-xl shadow-brand-cyan/5"
                  : isRest
                  ? "bg-surface/60 border-surface-border opacity-85"
                  : "bg-surface border-surface-border hover:border-brand-cyan/30"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                {/* Left: Date & Routine Meta */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-surface-elevated border border-surface-border text-gray-300">
                      {getDayLabel(workout.date)} • {getFormattedDate(workout.date)}
                    </span>

                    {isToday && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold uppercase bg-brand-cyan text-black">
                        Today
                      </span>
                    )}

                    {workout.isCompleted && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/40 flex items-center space-x-1">
                        <Check className="w-3 h-3" />
                        <span>Completed</span>
                      </span>
                    )}

                    <span className="text-xs text-gray-400 font-mono flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{workout.scheduledTime || "08:00"}</span>
                      <span>({workout.durationMinutes}m)</span>
                    </span>
                  </div>

                  <div className="flex items-center space-x-3 mt-1">
                    <div
                      className={`p-3 rounded-2xl flex items-center justify-center ${
                        isRest
                          ? "bg-gray-800 text-gray-400"
                          : "bg-brand-cyan/15 text-brand-cyan"
                      }`}
                    >
                      {isRest ? <Coffee className="w-6 h-6" /> : <Dumbbell className="w-6 h-6" />}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white">{workout.routineName}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{workout.notes}</p>
                    </div>
                  </div>

                  {/* Muscle focus tags */}
                  {workout.focusMuscleGroups && workout.focusMuscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {workout.focusMuscleGroups.map((muscle) => (
                        <span
                          key={muscle}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono uppercase bg-surface-elevated border border-surface-border text-gray-400"
                        >
                          {muscle}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Planned Exercises Checklist */}
                  {!isRest && plannedNames.length > 0 && (
                    <div className="pt-2">
                      <div className="text-[11px] font-mono uppercase text-gray-400 mb-1.5 flex items-center space-x-1">
                        <Layers className="w-3.5 h-3.5 text-brand-cyan" />
                        <span>Planned Exercises ({plannedNames.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {plannedNames.map((name, i) => (
                          <div
                            key={name + i}
                            className="flex items-center space-x-2 text-xs text-gray-300 bg-surface-elevated/60 px-3 py-1.5 rounded-xl border border-surface-border/50"
                          >
                            <span className="text-brand-cyan font-mono text-[10px] font-bold">
                              {i + 1}.
                            </span>
                            <span className="truncate">{name}</span>
                          </div>
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

                  {/* 1-Tap Google Calendar Web Button */}
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

                  <div className="flex items-center space-x-1 w-full sm:w-auto justify-end">
                    {/* Mark Done Toggle */}
                    <button
                      onClick={() => handleToggleCompleted(workout)}
                      className={`p-2 rounded-xl border text-xs transition-colors ${
                        workout.isCompleted
                          ? "bg-brand-emerald/20 border-brand-emerald text-brand-emerald"
                          : "bg-surface-elevated border-surface-border text-gray-400 hover:text-white"
                      }`}
                      title={workout.isCompleted ? "Mark incomplete" : "Mark completed"}
                    >
                      <Check className="w-4 h-4" />
                    </button>

                    {/* Toggle Rest/Workout Day */}
                    <button
                      onClick={() => handleToggleDayType(workout)}
                      className="px-2.5 py-2 rounded-xl bg-surface-elevated border border-surface-border text-xs text-gray-400 hover:text-white transition-colors"
                      title={isRest ? "Change to Workout" : "Change to Rest"}
                    >
                      {isRest ? "Make Workout" : "Make Rest"}
                    </button>

                    {/* Edit Details */}
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
          EDIT MODAL: CUSTOMIZE WORKOUT ROUTINE ON ANY DATE
          ========================================================================= */}
      {editingWorkout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl space-y-4">
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
