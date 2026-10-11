"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
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
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Coffee,
  X,
  Layers,
  ChevronDown,
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

export default function WorkoutsPage() {
  const { user, profile } = useAuth();
  const { saveWorkoutSet } = useCloudSync();
  const [activeTab, setActiveTab] = useState<"session" | "schedule">("session");
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

  // Check URL query param ?view=session or ?view=schedule
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      const dateParam = params.get("date");
      if (dateParam) setSelectedDate(dateParam);
      if (view === "schedule") setActiveTab("schedule");
      else if (view === "session") setActiveTab("session");
    }
  }, []);

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
        targetScheduled = await getOrCreateScheduledWorkoutForDate(
          user.id,
          targetDate,
          split,
          "08:00",
          profile?.workoutDaysPerWeek,
          profile?.customWeeklySchedule as any
        );
      }

      setScheduledDay(targetScheduled);
      setRoutineName(targetScheduled.routineName);

      if (targetScheduled.dayType === "rest" || targetScheduled.exerciseIds.length === 0) {
        setActiveExercises([]);
        setIsLoadingSession(false);
        return;
      }

      const selected = targetScheduled.exerciseIds
        .map((id) => allExercises.find((e) => e.id === id))
        .filter(Boolean) as LocalExercise[];

      const previousSets = await db.workoutSets
        .where("userId")
        .equals(user.id)
        .toArray();

      const workoutSessionExercises: ActiveExerciseState[] = selected.map((ex) => {
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

  const handleSelectDate = (dateStr: string) => setSelectedDate(dateStr);

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

  const handleJumpToToday = () => setSelectedDate(todayStr);

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

  const handleStartScheduledWorkout = async (scheduled: LocalScheduledWorkout) => {
    setSelectedDate(scheduled.date);
    await loadWorkoutForDate(scheduled.date, scheduled);
    setActiveTab("session");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Timer Tick
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

  const handleToggleSet = async (exIndex: number, setIndex: number) => {
    if (!user) return;
    const nextExercises = [...activeExercises];
    const targetSet = nextExercises[exIndex].sets[setIndex];
    const wasCompleted = targetSet.completed;

    targetSet.completed = !wasCompleted;

    if (!wasCompleted) {
      if (targetSet.prevWeightLbs !== null && targetSet.prevReps !== null) {
        const isWeightPr = targetSet.weightLbs > targetSet.prevWeightLbs;
        const isRepPr =
          targetSet.weightLbs === targetSet.prevWeightLbs && targetSet.reps > targetSet.prevReps;

        if (isWeightPr || isRepPr) {
          targetSet.isPr = true;
          const prMsg = isWeightPr
            ? `🔥 New Weight PR! +${targetSet.weightLbs - targetSet.prevWeightLbs} lbs on ${
                nextExercises[exIndex].exercise.name
              }`
            : `⚡ New Rep PR! +${targetSet.reps - targetSet.prevReps} reps on ${
                nextExercises[exIndex].exercise.name
              }`;
          setPrCelebration(prMsg);
          setTimeout(() => setPrCelebration(null), 3500);
        }
      }

      await saveWorkoutSet({
        workoutId: `session-${selectedDate}`,
        exerciseId: nextExercises[exIndex].exercise.id,
        setNumber: targetSet.setNumber,
        weightLbs: targetSet.weightLbs,
        reps: targetSet.reps,
        isWarmup: false,
        isPr: targetSet.isPr,
      });

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
        console.warn("Could not mark workout completed:", err);
      }

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
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formattedEyebrowDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* =========================================================================
          APPLE HEALTH LARGE TITLE HEADER
          ========================================================================= */}
      <header className="pt-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] block">
          {formattedEyebrowDate}
        </span>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Workouts
          </h1>

          {/* Quick Date Indicator */}
          <span className="text-xs font-semibold text-[#0A84FF] font-mono">
            {selectedDate === todayStr ? "TODAY" : formatFullDate(selectedDate)}
          </span>
        </div>
      </header>

      {/* =========================================================================
          APPLE NATIVE SEGMENTED CONTROL PILL
          ========================================================================= */}
      <div className="p-1 rounded-xl bg-[#1C1C1E] border border-[#2C2C2E] flex items-center">
        <button
          onClick={() => setActiveTab("session")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "session"
              ? "bg-[#2C2C2E] text-white shadow-sm"
              : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Dumbbell className="w-3.5 h-3.5 text-[#0A84FF]" />
          <span>Active Session</span>
        </button>

        <button
          onClick={() => setActiveTab("schedule")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "schedule"
              ? "bg-[#2C2C2E] text-white shadow-sm"
              : "text-[#8E8E93] hover:text-white"
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-[#30D158]" />
          <span>Schedule & Calendar</span>
        </button>
      </div>

      {activeTab === "schedule" ? (
        <WorkoutScheduleView onStartScheduledWorkout={handleStartScheduledWorkout} />
      ) : (
        <>
          {/* PR Celebration Floating Banner */}
          {prCelebration && (
            <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-[#30D158] text-black px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center space-x-2 animate-bounce">
              <Trophy className="w-5 h-5" />
              <span>{prCelebration}</span>
            </div>
          )}

          {/* =========================================================================
              DATE NAVIGATION BAR (Apple Health Style)
              ========================================================================= */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]/60">
            <div className="flex items-center space-x-1.5">
              <button
                onClick={handlePrevDay}
                className="p-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <label className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#2C2C2E] cursor-pointer hover:border-[#0A84FF] transition-colors">
                <Calendar className="w-3.5 h-3.5 text-[#0A84FF]" />
                <span className="text-xs font-bold text-white font-mono">
                  {formatFullDate(selectedDate)}
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
                  className="sr-only"
                />
              </label>

              {selectedDate === todayStr ? (
                <span className="px-2 py-0.5 rounded-md bg-[#0A84FF]/20 text-[#0A84FF] text-[10px] font-bold font-mono">
                  TODAY
                </span>
              ) : (
                <button
                  onClick={handleJumpToToday}
                  className="px-2 py-1 rounded-md bg-[#2C2C2E] text-[11px] font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Today
                </button>
              )}

              <button
                onClick={handleNextDay}
                className="p-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Routine Switcher Dropdown */}
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
              className="bg-[#2C2C2E] border border-[#38383A] rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-[#0A84FF] transition-colors"
            >
              {Object.entries(ROUTINE_TEMPLATES).map(([key, template]) => (
                <option key={key} value={key} className="bg-[#1C1C1E]">
                  {template.name.split("(")[0]}
                </option>
              ))}
            </select>
          </div>

          {/* =========================================================================
              ROUTINE HEADER CARD & REST TIMER HUD
              ========================================================================= */}
          <div className="p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF]">
                  {selectedDate === todayStr ? "Today's Target Session" : "Prescribed Session"}
                </span>
                {scheduledDay?.focusMuscleGroups && (
                  <div className="flex items-center space-x-1">
                    {scheduledDay.focusMuscleGroups.map((m) => (
                      <span
                        key={m}
                        className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#2C2C2E] text-[#8E8E93]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
                {routineName}
              </h2>
              <p className="text-xs text-[#8E8E93] mt-0.5">
                {scheduledDay?.notes || "Progressive overload hyper-focus session."}
              </p>
            </div>

            {/* Rest Timer Capsule */}
            <div className="flex items-center space-x-2.5 p-2.5 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex-shrink-0">
              <div className="flex items-center space-x-2">
                <Timer className="w-4 h-4 text-[#0A84FF]" />
                <div>
                  <div className="text-[9px] font-semibold text-[#8E8E93] uppercase">Rest Timer</div>
                  <div className="text-base font-bold font-mono text-white leading-none">
                    {formatTimer(restSecondsRemaining)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1 pl-2 border-l border-[#38383A]">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className="p-1.5 rounded-lg bg-[#1C1C1E] text-white hover:bg-black transition-colors"
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setRestSecondsRemaining(120);
                    setIsTimerRunning(true);
                  }}
                  className="p-1.5 rounded-lg bg-[#1C1C1E] text-[#8E8E93] hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              REST DAY VIEW OR APPLE FITNESS EXERCISE CARDS
              ========================================================================= */}
          {scheduledDay?.dayType === "rest" ? (
            <div className="p-8 rounded-[24px] bg-[#1C1C1E] border border-[#2C2C2E]/60 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center mx-auto">
                <Coffee className="w-7 h-7" />
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF9500]">
                  Rest & Muscle Growth Day
                </span>
                <h3 className="text-xl font-bold text-white mt-1">Active Recovery Scheduled</h3>
                <p className="text-xs text-[#8E8E93] max-w-sm mx-auto mt-1">
                  Muscles grow outside the gym. Hit your protein and surplus targets for recovery.
                </p>
              </div>

              <div className="pt-2">
                <p className="text-xs text-[#8E8E93] mb-2">Want to train anyway?</p>
                <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto">
                  {Object.entries(ROUTINE_TEMPLATES)
                    .filter(([k]) => k !== "rest")
                    .map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => handleSwitchRoutine(t)}
                        className="px-3 py-1.5 rounded-xl bg-[#2C2C2E] hover:bg-[#38383A] text-xs font-semibold text-white transition-all active:scale-95"
                      >
                        {t.name.split("(")[0]}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeExercises.map((item, exIndex) => (
                <div
                  key={item.exercise.id}
                  className="p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl space-y-3"
                >
                  {/* Exercise Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-[#2C2C2E]">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93]">
                        {item.exercise.muscleGroup} • {item.exercise.isCompound ? "Compound" : "Isolation"}
                      </span>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {item.exercise.name}
                      </h3>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-mono text-[#8E8E93]">Target</span>
                      <div className="text-xs font-bold text-[#0A84FF] font-mono">
                        {item.targetSets} sets × {item.targetReps}
                      </div>
                    </div>
                  </div>

                  {/* Grouped Set Table Rows (Apple Fitness Style) */}
                  <div className="divide-y divide-[#2C2C2E]">
                    {/* Header */}
                    <div className="grid grid-cols-12 text-[10px] font-semibold uppercase text-[#8E8E93] pb-1.5 px-1 font-mono">
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
                        className={`grid grid-cols-12 items-center py-2.5 px-1 rounded-xl transition-colors ${
                          set.completed ? "bg-[#30D158]/5" : "hover:bg-[#2C2C2E]/30"
                        }`}
                      >
                        {/* Set # */}
                        <div className="col-span-2 flex items-center space-x-1 font-mono text-xs font-bold text-white">
                          <span>#{set.setNumber}</span>
                          {set.isPr && (
                            <span className="text-[8px] bg-[#0A84FF]/20 text-[#0A84FF] px-1 rounded">
                              PR
                            </span>
                          )}
                        </div>

                        {/* Benchmark */}
                        <div className="col-span-4 text-xs font-mono text-[#8E8E93] truncate">
                          {set.prevWeightLbs !== null && set.prevReps !== null ? (
                            `${set.prevWeightLbs} lbs × ${set.prevReps}`
                          ) : (
                            <span className="text-[#8E8E93]/60 italic">None (Day 1)</span>
                          )}
                        </div>

                        {/* Weight Stepper */}
                        <div className="col-span-3 flex items-center justify-center space-x-1 font-mono">
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "weightLbs", -5)}
                            className="w-5 h-5 rounded bg-[#2C2C2E] text-xs text-[#8E8E93] hover:text-white flex items-center justify-center"
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
                            className="text-xs font-bold text-white w-10 text-center bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "weightLbs", 5)}
                            className="w-5 h-5 rounded bg-[#2C2C2E] text-xs text-[#8E8E93] hover:text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* Reps Stepper */}
                        <div className="col-span-2 flex items-center justify-center space-x-1 font-mono">
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "reps", -1)}
                            className="w-5 h-5 rounded bg-[#2C2C2E] text-xs text-[#8E8E93] hover:text-white flex items-center justify-center"
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
                            className="text-xs font-bold text-white w-7 text-center bg-transparent focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateSetValue(exIndex, setIndex, "reps", 1)}
                            className="w-5 h-5 rounded bg-[#2C2C2E] text-xs text-[#8E8E93] hover:text-white flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>

                        {/* Circular Checkmark Button (Turns Apple Green #30D158) */}
                        <div className="col-span-1 flex justify-end">
                          <button
                            onClick={() => handleToggleSet(exIndex, setIndex)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                              set.completed
                                ? "bg-[#30D158] text-black shadow-md shadow-[#30D158]/30"
                                : "border-2 border-[#38383A] text-transparent hover:border-[#0A84FF]"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Add Exercise Action */}
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => setIsAddExerciseModalOpen(true)}
                  className="px-5 py-2.5 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-xs font-semibold text-white flex items-center space-x-2 transition-all active:scale-95 shadow-md"
                >
                  <Plus className="w-4 h-4 text-[#0A84FF]" />
                  <span>Add Exercise to Session</span>
                </button>
              </div>
            </div>
          )}

          {/* Add Exercise Modal */}
          {isAddExerciseModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
              <div className="w-full max-w-md rounded-3xl bg-[#1C1C1E] border border-[#38383A] p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
                  <h3 className="text-base font-bold text-white">Add Exercise</h3>
                  <button
                    onClick={() => setIsAddExerciseModalOpen(false)}
                    className="p-1.5 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="overflow-y-auto space-y-1.5 pr-1 flex-1">
                  {exercises
                    .filter((ex) => !scheduledDay?.exerciseIds.includes(ex.id))
                    .map((ex) => (
                      <div
                        key={ex.id}
                        onClick={() => handleAddExerciseToWorkout(ex)}
                        className="flex items-center justify-between p-3 rounded-2xl bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] border border-[#38383A] cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="text-xs font-bold text-white">{ex.name}</div>
                          <div className="text-[10px] text-[#8E8E93] font-mono capitalize">
                            {ex.muscleGroup} • {ex.isCompound ? "Compound" : "Isolation"}
                          </div>
                        </div>
                        <Plus className="w-4 h-4 text-[#0A84FF]" />
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
