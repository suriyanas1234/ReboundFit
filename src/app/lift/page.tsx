"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Flame,
  ChevronDown,
} from "lucide-react";

interface ActiveSetState {
  id: string;
  setNumber: number;
  weightLbs: number;
  reps: number;
  prevWeightLbs: number;
  prevReps: number;
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
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [routineName, setRoutineName] = useState<string>("Push Day A (Hypertrophy)");
  const [activeExercises, setActiveExercises] = useState<ActiveExerciseState[]>([]);
  const [prCelebration, setPrCelebration] = useState<string | null>(null);

  // Rest Timer State
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load exercises from local DB & build workout session
  useEffect(() => {
    const initWorkout = async () => {
      const allExercises = await db.exercises.toArray();
      setExercises(allExercises);

      // Select Push Day exercises as default
      const pushExercises = allExercises.filter(
        (ex) => ex.muscleGroup === "chest" || ex.muscleGroup === "shoulders" || ex.muscleGroup === "triceps"
      );

      const samplePreviousBenchmarks: Record<string, { weight: number; reps: number }> = {
        "ex-1": { weight: 185, reps: 8 },
        "ex-2": { weight: 75, reps: 9 },
        "ex-5": { weight: 115, reps: 7 },
        "ex-8": { weight: 25, reps: 14 },
        "ex-10": { weight: 45, reps: 12 },
      };

      const workoutSessionExercises: ActiveExerciseState[] = pushExercises.slice(0, 4).map((ex) => {
        const prev = samplePreviousBenchmarks[ex.id] || { weight: 135, reps: 8 };
        return {
          exercise: ex,
          targetSets: 3,
          targetReps: ex.isCompound ? "6-10" : "10-15",
          restSeconds: ex.defaultRestSeconds,
          sets: [
            {
              id: `${ex.id}-s1`,
              setNumber: 1,
              weightLbs: prev.weight,
              reps: prev.reps,
              prevWeightLbs: prev.weight,
              prevReps: prev.reps,
              completed: false,
              isPr: false,
            },
            {
              id: `${ex.id}-s2`,
              setNumber: 2,
              weightLbs: prev.weight,
              reps: Math.max(1, prev.reps - 1),
              prevWeightLbs: prev.weight,
              prevReps: Math.max(1, prev.reps - 1),
              completed: false,
              isPr: false,
            },
            {
              id: `${ex.id}-s3`,
              setNumber: 3,
              weightLbs: prev.weight,
              reps: Math.max(1, prev.reps - 2),
              prevWeightLbs: prev.weight,
              prevReps: Math.max(1, prev.reps - 2),
              completed: false,
              isPr: false,
            },
          ],
        };
      });

      setActiveExercises(workoutSessionExercises);
    };

    initWorkout();
  }, []);

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
      // Web Audio API gentle synth chime
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

      // Navigator Vibrate for subtle mobile haptic
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 60, 120]);
      }
    } catch {
      // AudioContext unavailable
    }
  };

  // Toggle Set Complete & Check for PR
  const handleToggleSet = (exIndex: number, setIndex: number) => {
    const nextExercises = [...activeExercises];
    const targetSet = nextExercises[exIndex].sets[setIndex];
    const wasCompleted = targetSet.completed;

    targetSet.completed = !wasCompleted;

    if (!wasCompleted) {
      // Check PR condition: higher weight OR higher reps than previous session benchmark
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
    next[exIndex].sets[setIndex][field] = Math.max(1, current + delta);
    setActiveExercises(next);
  };

  // Format rest timer MM:SS
  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
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
            Inline previous weights displayed for zero-hesitation target setting.
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

            {/* Set Table with Inline Previous Session Benchmarks */}
            <div className="divide-y divide-surface-border/60">
              {/* Header */}
              <div className="grid grid-cols-12 text-[10px] font-mono uppercase text-gray-400 pb-2 px-2">
                <div className="col-span-2">Set</div>
                <div className="col-span-4">Prev Session</div>
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

                  {/* Previous Benchmark Ghost Label */}
                  <div className="col-span-4 text-xs font-mono text-gray-400">
                    {set.prevWeightLbs} lbs × {set.prevReps}
                  </div>

                  {/* Weight Stepper */}
                  <div className="col-span-3 flex items-center justify-center space-x-1 font-mono">
                    <button
                      onClick={() => handleUpdateSetValue(exIndex, setIndex, "weightLbs", -5)}
                      className="w-6 h-6 rounded bg-surface-elevated text-xs text-gray-400 hover:text-white flex items-center justify-center"
                    >
                      -
                    </button>
                    <span className="text-xs font-bold text-white w-9 text-center">
                      {set.weightLbs}
                    </span>
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
                    <span className="text-xs font-bold text-white w-6 text-center">{set.reps}</span>
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
    </div>
  );
}
