"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalExercise, LocalWorkoutSet, LocalScheduledWorkout } from "@/lib/db";
import {
  Dumbbell,
  Check,
  Trophy,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Sparkles,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coffee,
  X,
  Layers,
} from "lucide-react";
import { WorkoutScheduleView } from "@/components/schedule/WorkoutScheduleView";
import {
  getOrCreateScheduledWorkoutForDate,
  updateScheduledWorkout,
  ROUTINE_TEMPLATES,
  RoutineTemplate,
} from "@/algorithms/workoutScheduler";

interface ActiveSetState {
  id: string;
  setNumber: number;
  weightLbs: number;
  reps: number;
  prevWeightLbs: number | null;
  prevReps: number | null;
  completed: boolean;
  isPr: boolean;
}

interface ActiveExerciseState {
  exercise: LocalExercise;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: ActiveSetState[];
}

export default function LiftTrackerPage() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"schedule" | "session">("schedule");
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [routineName, setRoutineName] = useState<string>("Workout Session");
  const [activeExercises, setActiveExercises] = useState<ActiveExerciseState[]>([]);
  const [prCelebration, setPrCelebration] = useState<string | null>(null);

  // Today & Selected Date
  const todayStr = new Date().toISOString().split("T")[0]; // "2026-10-11"
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [scheduledDay, setScheduledDay] = useState<LocalScheduledWorkout | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [isAddExerciseModalOpen, setIsAddExerciseModalOpen] = useState<boolean>(false);

  // Rest Timer State
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check URL query param ?view=session or ?view=schedule and optional ?date=YYYY-MM-DD
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const dateParam = params.get("date");
      if (dateParam) {
        setSelectedDate(dateParam);
      }
      if (view === "session") setActiveTab("session");
      else if (view === "schedule") setActiveTab("schedule");
    }
  }, []);

  /**
   * Loads the scheduled workout and exercises for the selected date.
   */
  const loadWorkoutForDate = async (
    targetDate: string,
    explicitScheduled?: LocalScheduledWorkout
  ) => {
    if (!user) return;
    setIsLoadingSession(true);
    try {
      const allExercises = await db.exercises.toArray();
      setExercises(allExercises);

      let targetScheduled = explicitScheduled;
      if (!targetScheduled) {
        const split = (profile?.trainingSplit || "ppl") as any;
        targetScheduled = await getOrCreateScheduledWorkoutForDate(user.id, targetDate, split);
      }

      setScheduledDay(targetScheduled);
      setRoutineName(targetScheduled.routineName);

      if (targetScheduled.dayType === "rest" || targetScheduled.exerciseIds.length === 0) {
        setActiveExercises([]);
        setIsLoadingSession(false);
        return;
      }

      // Map exercises from database matching the scheduled IDs
      const selected = targetScheduled.exerciseIds
        .map((id) => allExercises.find((e) => e.id === id))
        .filter(Boolean) as LocalExercise[];

      // Fetch real user history for previous benchmarks (zero fake numbers)
      const previousSets = await db.workoutSets
        .where("userId")
        .equals(user.id)
        .toArray();

      const workoutSessionExercises: ActiveExerciseState[] = selected.map((ex) => {
        // Find user's best set from prior workouts
        const priorSetsForEx = previousSets
          .filter((s) => s.exerciseId === ex.id && !s.isWarmup)
          .sort((a, b) => b.weightLbs - a.weightLbs);

        const bestPrior = priorSetsForEx[0] || null;
        const defaultWeight = bestPrior ? bestPrior.weightLbs : 0;
        const defaultReps = bestPrior ? bestPrior.reps : 8;

        return {
          exercise: ex,
          targetSets: 3,
          targetReps: ex.isCompound ? "6-10" : "10-15",
          restSeconds: ex.defaultRestSeconds,
          sets: [1, 2, 3].map((setNum) => ({
            id: `${ex.id}-s${setNum}`,
            setNumber: setNum,
            weightLbs: defaultWeight,
            reps: defaultReps,
            prevWeightLbs: bestPrior ? bestPrior.weightLbs : null,
            prevReps: bestPrior ? bestPrior.reps : null,
            completed: false,
            isPr: false,
          })),
        };
      });

      setActiveExercises(workoutSessionExercises);
    } catch (err) {
      console.error("Failed to load workout for date:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadWorkoutForDate(selectedDate);
    }
  }, [user, profile, selectedDate]);

  // Navigate Date Handler
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handlePrevDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayStr);
  };

  // Switch routine for the active day
  const handleSwitchRoutine = async (template: RoutineTemplate) => {
    if (!user || !scheduledDay) return;
    const updated: LocalScheduledWorkout = {
      ...scheduledDay,
      routineName: template.name,
      dayType: template.dayType,
      focusMuscleGroups: template.focusMuscleGroups,
      exerciseIds: template.exerciseIds,
      durationMinutes: template.defaultDurationMinutes,
      notes: template.description,
      updatedAt: new Date().toISOString(),
    };
    await updateScheduledWorkout(updated);
    await loadWorkoutForDate(selectedDate, updated);
  };

  // Toggle manual completion of current day's workout
  const handleToggleManualComplete = async () => {
    if (!scheduledDay) return;
    const updated: LocalScheduledWorkout = {
      ...scheduledDay,
      isCompleted: !scheduledDay.isCompleted,
      updatedAt: new Date().toISOString(),
    };
    await updateScheduledWorkout(updated);
    setScheduledDay(updated);
  };

  // Add individual exercise to today's workout
  const handleAddExerciseToWorkout = async (exercise: LocalExercise) => {
    if (!user || !scheduledDay) return;
    if (scheduledDay.exerciseIds.includes(exercise.id)) return;

    const nextExerciseIds = [...scheduledDay.exerciseIds, exercise.id];
    const updated: LocalScheduledWorkout = {
      ...scheduledDay,
      dayType: "workout",
      exerciseIds: nextExerciseIds,
      updatedAt: new Date().toISOString(),
    };
    await updateScheduledWorkout(updated);
    await loadWorkoutForDate(selectedDate, updated);
    setIsAddExerciseModalOpen(false);
  };

  // Start Scheduled Workout from Schedule tab
  const handleStartScheduledWorkout = async (scheduled: LocalScheduledWorkout) => {
    setSelectedDate(scheduled.date);
    await loadWorkoutForDate(scheduled.date, scheduled);
    setActiveTab("session");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Timer Tick Effect
  useEffect(() => {
    if (isTimerRunning && restSecondsRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev <= 1) {
            triggerTimerChimeAndHaptic();
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, restSecondsRemaining]);

  // Audio & Haptic alert
  const triggerTimerChimeAndHaptic = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);

      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 60, 120]);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  // Toggle Set Complete & Check for PR
  const handleToggleSet = async (exIndex: number, setIndex: number) => {
    if (!user) return;
    const nextExercises = [...activeExercises];
    const targetSet = nextExercises[exIndex].sets[setIndex];
    const wasCompleted = targetSet.completed;

    targetSet.completed = !wasCompleted;

    if (!wasCompleted) {
      // Check PR condition if prior benchmarks exist
      if (targetSet.prevWeightLbs !== null && targetSet.prevReps !== null) {
        const isWeightPr = targetSet.weightLbs > targetSet.prevWeightLbs;
        const isRepPr =
          targetSet.weightLbs === targetSet.prevWeightLbs && targetSet.reps > targetSet.prevReps;

        if (isWeightPr || isRepPr) {
          targetSet.isPr = true;
          const prMsg = isWeightPr
            ? `🔥 NEW WEIGHT PR! +${targetSet.weightLbs - targetSet.prevWeightLbs} lbs on ${
                nextExercises[exIndex].exercise.name
              }`
            : `⚡ NEW REP PR! +${targetSet.reps - targetSet.prevReps} reps on ${
                nextExercises[exIndex].exercise.name
              }`;
          setPrCelebration(prMsg);
          setTimeout(() => setPrCelebration(null), 4000);
        }
      }

      // Save real set to Dexie
      const workoutSetRecord: LocalWorkoutSet = {
        id: `set-${user.id}-${Date.now()}-${targetSet.setNumber}`,
        userId: user.id,
        workoutId: `session-${selectedDate}`,
        exerciseId: nextExercises[exIndex].exercise.id,
        setNumber: targetSet.setNumber,
        weightLbs: targetSet.weightLbs,
        reps: targetSet.reps,
        isWarmup: false,
        isPr: targetSet.isPr,
        synced: false,
      };
      await db.workoutSets.put(workoutSetRecord);

      // Auto-mark scheduled workout for this date as completed
      try {
        if (scheduledDay && !scheduledDay.isCompleted) {
          const updated: LocalScheduledWorkout = {
            ...scheduledDay,
            isCompleted: true,
            updatedAt: new Date().toISOString(),
          };
          await db.scheduledWorkouts.put(updated);
          setScheduledDay(updated);
        }
      } catch (err) {
        console.warn("Could not mark workout completed in Dexie:", err);
      }

      // Auto-start rest timer
      setRestSecondsRemaining(nextExercises[exIndex].restSeconds);
      setIsTimerRunning(true);
    }

    setActiveExercises(nextExercises);
  };

  const handleUpdateSetValue = (
    exIndex: number,
    setIndex: number,
    field: "weightLbs" | "reps",
    delta: number
  ) => {
    const next = [...activeExercises];
    const current = next[exIndex].sets[setIndex][field];
    next[exIndex].sets[setIndex][field] = Math.max(0, current + delta);
    setActiveExercises(next);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* =========================================================================
          TOP TAB BAR: WORKOUT SCHEDULE (CALENDAR) VS ACTIVE SESSION LOGGER
          ========================================================================= */}
      <div className="flex items-center space-x-2 p-1.5 rounded-2xl bg-surface border border-surface-border">
        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "schedule"
              ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-md shadow-brand-cyan/10"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Workout Schedule & Google Calendar</span>
        </button>

        <button
          onClick={() => {
            if (!selectedDate) setSelectedDate(todayStr);
            setActiveTab("session");
          }}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "session"
              ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-md shadow-brand-cyan/10"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>
            Active Overload Session ({selectedDate === todayStr ? "Today" : formatShortDate(selectedDate)} •{" "}
            {routineName.split("(")[0].trim()})
          </span>
        </button>
      </div>

      {activeTab === "schedule" ? (
        <WorkoutScheduleView onStartScheduledWorkout={handleStartScheduledWorkout} />
      ) : (
        <>
          {/* PR Celebration Alert Banner */}
          {prCelebration && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-brand-cyan to-brand-emerald text-black px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center space-x-2 animate-bounce">
              <Trophy className="w-5 h-5" />
              <span>{prCelebration}</span>
            </div>
          )}

          {/* =========================================================================
              ACTIVE SESSION DATE SELECTOR & STATUS BAR
              ========================================================================= */}
          <div className="rounded-3xl bg-surface border border-surface-border p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2 flex-wrap sm:flex-nowrap">
              {/* Prev Day */}
              <button
                onClick={handlePrevDay}
                className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border text-gray-300 hover:text-white transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Date Badge / Date Picker */}
              <div className="relative flex items-center">
                <label className="flex items-center space-x-2.5 px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border cursor-pointer hover:border-brand-cyan/40 transition-colors">
                  <Calendar className="w-4 h-4 text-brand-cyan" />
                  <span className="text-sm font-bold text-white font-mono">
                    {formatFullDate(selectedDate)}
                  </span>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>

              {selectedDate === todayStr ? (
                <span className="px-2.5 py-1.5 rounded-lg bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-[11px] font-mono font-black uppercase">
                  Today
                </span>
              ) : (
                <button
                  onClick={handleJumpToToday}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border text-gray-300 hover:text-white text-xs font-mono transition-colors"
                >
                  Jump to Today
                </button>
              )}

              {/* Next Day */}
              <button
                onClick={handleNextDay}
                className="p-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border text-gray-300 hover:text-white transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Routine Selector & Completion Toggle */}
            <div className="flex items-center space-x-3 flex-wrap sm:flex-nowrap">
              {/* Change Routine Select */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-mono hidden sm:inline">Routine:</span>
                <select
                  value={
                    Object.entries(ROUTINE_TEMPLATES).find(
                      ([, t]) => t.name === scheduledDay?.routineName
                    )?.[0] || "custom"
                  }
                  onChange={(e) => {
                    const template = ROUTINE_TEMPLATES[e.target.value];
                    if (template) handleSwitchRoutine(template);
                  }}
                  className="bg-surface-elevated border border-surface-border rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-brand-cyan transition-colors"
                >
                  {Object.entries(ROUTINE_TEMPLATES).map(([key, template]) => (
                    <option key={key} value={key} className="bg-[#12141a] text-white">
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mark Completed Toggle */}
              {scheduledDay?.isCompleted ? (
                <button
                  onClick={handleToggleManualComplete}
                  className="px-3.5 py-2 rounded-xl bg-brand-emerald/15 border border-brand-emerald/30 text-brand-emerald font-bold text-xs flex items-center space-x-1.5 hover:bg-brand-emerald/25 transition-all"
                  title="Click to toggle completion status"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Completed</span>
                </button>
              ) : (
                <button
                  onClick={handleToggleManualComplete}
                  className="px-3.5 py-2 rounded-xl bg-surface-elevated border border-surface-border hover:border-surface-border/80 text-gray-400 hover:text-white font-semibold text-xs flex items-center space-x-1.5 transition-all"
                  title="Mark as completed"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Mark Done</span>
                </button>
              )}
            </div>
          </div>

          {/* =========================================================================
              ROUTINE HEADER CARD & REST TIMER HUD
              ========================================================================= */}
          <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono uppercase tracking-wider text-brand-cyan">
                  {selectedDate === todayStr ? "Today's Prescribed Session" : "Scheduled Session"}
                </span>
                {scheduledDay?.focusMuscleGroups && (
                  <div className="flex items-center space-x-1">
                    {scheduledDay.focusMuscleGroups.map((m) => (
                      <span
                        key={m}
                        className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-surface-elevated text-gray-400 border border-surface-border"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mt-1">{routineName}</h2>
              <p className="text-xs text-gray-400 mt-1 max-w-xl">
                {scheduledDay?.notes ||
                  "Zero mock numbers. Set your weights to establish your progressive overload baselines."}
              </p>
            </div>

            {/* Floating / Docked Rest Timer HUD */}
            <div className="flex items-center space-x-3 p-3 rounded-2xl bg-surface-elevated border border-surface-border flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Timer className="w-5 h-5 text-brand-cyan" />
                <div>
                  <div className="text-[10px] font-mono text-gray-400 uppercase">Rest Timer</div>
                  <div className="text-lg font-black font-mono text-white">
                    {formatTimer(restSecondsRemaining)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 pl-2 border-l border-surface-border">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="p-2 rounded-xl bg-surface hover:bg-surface-elevated text-gray-300 hover:text-white"
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setRestSecondsRemaining(120);
                    setIsTimerRunning(true);
                  }}
                  className="p-2 rounded-xl bg-surface hover:bg-surface-elevated text-gray-300 hover:text-white"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              REST DAY VIEW OR EXERCISES LIST
              ========================================================================= */}
          {scheduledDay?.dayType === "rest" ? (
            <div className="rounded-3xl bg-surface border border-surface-border p-8 shadow-xl text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
                <Coffee className="w-8 h-8" />
              </div>
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  {selectedDate === todayStr ? "Today's Schedule" : "Scheduled Status"}
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">Rest & Active Recovery</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto mt-2 leading-relaxed">
                  No lifting session scheduled for {formatFullDate(selectedDate)}. Muscle protein
                  synthesis, glycogen replenishment, and CNS recovery occur on rest days.
                </p>
              </div>

              <div className="pt-2">
                <p className="text-xs text-gray-500 mb-3">
                  Want to train today anyway? Select a routine to start logging:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl mx-auto">
                  {Object.entries(ROUTINE_TEMPLATES)
                    .filter(([key]) => key !== "rest")
                    .map(([key, template]) => (
                      <button
                        key={key}
                        onClick={() => handleSwitchRoutine(template)}
                        className="px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border hover:border-brand-cyan/40 text-xs font-semibold text-gray-300 hover:text-white transition-all active:scale-95"
                      >
                        {template.name.split("(")[0].trim()}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {activeExercises.map((item, exIndex) => (
                <div
                  key={item.exercise.id}
                  className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4"
                >
                  {/* Exercise Title & Recommendation */}
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400">
                        {item.exercise.muscleGroup} • {item.exercise.isCompound ? "Compound Lift" : "Isolation"}
                      </span>
                      <h3 className="text-lg font-bold text-white">{item.exercise.name}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono text-gray-400">Target Range</span>
                      <div className="text-xs font-mono font-bold text-brand-cyan">
                        {item.targetSets} sets × {item.targetReps} reps
                      </div>
                    </div>
                  </div>

                  {/* Set Table */}
                  <div className="divide-y divide-surface-border/60">
                    {/* Header */}
                    <div className="grid grid-cols-12 text-[10px] font-mono uppercase text-gray-400 pb-2 px-2">
                      <div className="col-span-2">Set</div>
                      <div className="col-span-4">Previous Target</div>
                      <div className="col-span-3 text-center">Weight</div>
                      <div className="col-span-2 text-center">Reps</div>
                      <div className="col-span-1 text-right">Done</div>
                    </div>

                    {/* Rows */}
                    {item.sets.map((set, setIndex) => (
                      <div
                        key={set.id}
                        className={`grid grid-cols-12 items-center py-3 px-2 rounded-xl transition-colors ${
                          set.completed ? "bg-brand-emerald/5" : "hover:bg-surface-elevated/40"
                        }`}
                      >
                        {/* Set Number */}
                        <div className="col-span-2 flex items-center space-x-1.5 font-mono text-xs font-bold text-white">
                          <span>#{set.setNumber}</span>
                          {set.isPr && (
                            <span className="text-[9px] bg-brand-cyan/20 text-brand-cyan px-1 rounded">
                              PR
                            </span>
                          )}
                        </div>

                        {/* Previous Benchmark Label */}
                        <div className="col-span-4 text-xs font-mono text-gray-400">
                          {set.prevWeightLbs !== null && set.prevReps !== null ? (
                            `${set.prevWeightLbs} lbs × ${set.prevReps}`
                          ) : (
                            <span className="text-gray-500 italic">None (Day 1)</span>
                          )}
                        </div>

                        {/* Weight Stepper */}
                        <div className="col-span-3 flex items-center justify-center space-x-1 font-mono">
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "weightLbs", -5)}
                            className="w-6 h-6 rounded bg-surface-elevated text-xs text-gray-400 hover:text-white flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={set.weightLbs || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const next = [...activeExercises];
                              next[exIndex].sets[setIndex].weightLbs = parseFloat(e.target.value) || 0;
                              setActiveExercises(next);
                            }}
                            className="text-xs font-bold text-white w-12 text-center bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "weightLbs", 5)}
                            className="w-6 h-6 rounded bg-surface-elevated text-xs text-gray-400 hover:text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* Reps Stepper */}
                        <div className="col-span-2 flex items-center justify-center space-x-1 font-mono">
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "reps", -1)}
                            className="w-6 h-6 rounded bg-surface-elevated text-xs text-gray-400 hover:text-white flex items-center justify-center"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={set.reps || ""}
                            placeholder="0"
                            onChange={(e) => {
                              const next = [...activeExercises];
                              next[exIndex].sets[setIndex].reps = parseInt(e.target.value) || 0;
                              setActiveExercises(next);
                            }}
                            className="text-xs font-bold text-white w-8 text-center bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "reps", 1)}
                            className="w-6 h-6 rounded bg-surface-elevated text-xs text-gray-400 hover:text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* Complete Checkbox */}
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handleToggleSet(exIndex, setIndex)}
                            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                              set.completed
                                ? "bg-brand-emerald text-black shadow-md shadow-brand-emerald/20"
                                : "border border-surface-border text-transparent hover:border-brand-cyan/50"
                            }`}
                          >
                            <Check className="w-4 h-4 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Bottom Action: Add Exercise to Session */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setIsAddExerciseModalOpen(true)}
                  className="px-5 py-3 rounded-2xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border hover:border-brand-cyan/40 text-xs font-bold text-gray-300 hover:text-white flex items-center space-x-2 transition-all active:scale-95"
                >
                  <Plus className="w-4 h-4 text-brand-cyan" />
                  <span>Add Another Exercise to Today's Session</span>
                </button>
              </div>
            </div>
          )}

          {/* =========================================================================
              ADD EXERCISE MODAL
              ========================================================================= */}
          {isAddExerciseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-surface-border">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-brand-cyan" />
                    <h3 className="text-lg font-bold text-white">Add Exercise to Session</h3>
                  </div>
                  <button
                    onClick={() => setIsAddExerciseModalOpen(false)}
                    className="p-1.5 rounded-xl hover:bg-surface-elevated text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto space-y-2 pr-1 flex-1">
                  {exercises
                    .filter((ex) => !scheduledDay?.exerciseIds.includes(ex.id))
                    .map((ex) => (
                      <div
                        key={ex.id}
                        onClick={() => handleAddExerciseToWorkout(ex)}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-border hover:border-brand-cyan/50 cursor-pointer transition-all"
                      >
                        <div>
                          <div className="text-sm font-bold text-white">{ex.name}</div>
                          <div className="text-[11px] font-mono text-gray-400 capitalize">
                            {ex.muscleGroup} • {ex.isCompound ? "Compound" : "Isolation"}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-brand-cyan" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
