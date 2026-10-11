"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalExercise, LocalWorkout, LocalWorkoutSet } from "@/lib/db";
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
} from "lucide-react";
import { WorkoutScheduleView } from "@/components/schedule/WorkoutScheduleView";
import { LocalScheduledWorkout } from "@/lib/db";

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

  // Rest Timer State
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check URL query param ?view=session or ?view=schedule
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view === "session") setActiveTab("session");
      else if (view === "schedule") setActiveTab("schedule");
    }
  }, []);

  const loadRoutineExercises = async (targetRoutineName?: string, targetExerciseIds?: string[]) => {
    if (!user) return;
    const allExercises = await db.exercises.toArray();
    setExercises(allExercises);

    let selected: LocalExercise[] = [];
    let name = targetRoutineName || "Workout Session";

    if (targetExerciseIds && targetExerciseIds.length > 0) {
      selected = targetExerciseIds
        .map((id) => allExercises.find((e) => e.id === id))
        .filter(Boolean) as LocalExercise[];
    } else {
      const split = profile?.trainingSplit || "ppl";
      if (split === "ppl") {
        name = "Push Day A (Chest & Triceps Hypertrophy)";
        selected = allExercises.filter(
          (ex) => ex.muscleGroup === "chest" || ex.muscleGroup === "shoulders" || ex.muscleGroup === "triceps"
        );
      } else if (split === "upper_lower") {
        name = "Upper Body A (Chest, Back, Shoulders)";
        selected = allExercises.filter(
          (ex) => ex.muscleGroup === "chest" || ex.muscleGroup === "back" || ex.muscleGroup === "shoulders"
        );
      } else if (split === "full_body") {
        name = "Full Body A (Squat, Press, Row)";
        selected = allExercises.filter(
          (ex) => ex.id === "ex-3" || ex.id === "ex-1" || ex.id === "ex-7" || ex.id === "ex-8"
        );
      } else {
        name = "Custom / Blank Routine";
        selected = allExercises.slice(0, 3);
      }
    }

    setRoutineName(name);

    // Fetch real user history for previous benchmarks (ZERO FAKE SEEDING)
    const previousSets = await db.workoutSets
      .where("userId")
      .equals(user.id)
      .toArray();

    const workoutSessionExercises: ActiveExerciseState[] = selected.slice(0, 6).map((ex) => {
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
  };

  useEffect(() => {
    loadRoutineExercises();
  }, [user, profile]);

  const handleStartScheduledWorkout = async (scheduled: LocalScheduledWorkout) => {
    await loadRoutineExercises(scheduled.routineName, scheduled.exerciseIds);
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
        workoutId: `session-${new Date().toISOString().split("T")[0]}`,
        exerciseId: nextExercises[exIndex].exercise.id,
        setNumber: targetSet.setNumber,
        weightLbs: targetSet.weightLbs,
        reps: targetSet.reps,
        isWarmup: false,
        isPr: targetSet.isPr,
        synced: false,
      };
      await db.workoutSets.put(workoutSetRecord);

      // Auto-mark today's scheduled workout as completed
      try {
        const today = new Date().toISOString().split("T")[0];
        const todaySched = await db.scheduledWorkouts
          .where("userId")
          .equals(user.id)
          .and((item) => item.date === today)
          .first();
        if (todaySched && !todaySched.isCompleted) {
          await db.scheduledWorkouts.put({ ...todaySched, isCompleted: true });
        }
      } catch {
        // Dexie table check
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
          onClick={() => setActiveTab("session")}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-bold transition-all ${
            activeTab === "session"
              ? "bg-brand-cyan/20 text-brand-cyan border border-brand-cyan/40 shadow-md shadow-brand-cyan/10"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Dumbbell className="w-4 h-4" />
          <span>Active Session Logger ({routineName.split("(")[0].trim()})</span>
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

          {/* Routine Header */}
          <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-brand-cyan">
                Active Overload Session
              </span>
              <h2 className="text-2xl font-bold text-white mt-0.5">{routineName}</h2>
              <p className="text-xs text-gray-400 mt-1">
                Zero mock numbers. Set your Day 1 weights to establish your progressive overload baselines.
              </p>
            </div>

        {/* Floating / Docked Rest Timer HUD */}
        <div className="flex items-center space-x-3 p-3 rounded-2xl bg-surface-elevated border border-surface-border">
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

      {/* Exercise Cards */}
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
      </div>
    </>
  )}
</div>
);
}
