"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Timer,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minus,
  Check,
  Trophy,
  Coffee,
  Dumbbell,
  Sparkles,
} from "lucide-react";
import { LocalExercise, LocalScheduledWorkout } from "@/lib/db";
import { ROUTINE_TEMPLATES, RoutineTemplate } from "@/algorithms/workoutScheduler";

export interface ActiveSetState {
  id: string;
  setNumber: number;
  weightLbs: number;
  reps: number;
  prevWeightLbs: number | null;
  prevReps: number | null;
  completed: boolean;
  isPr: boolean;
}

export interface ActiveExerciseState {
  exercise: LocalExercise;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  sets: ActiveSetState[];
}

export interface WorkoutSessionProps {
  selectedDate: string;
  todayStr: string;
  scheduledDay: LocalScheduledWorkout | null;
  routineName: string;
  activeExercises: ActiveExerciseState[];
  onSelectDate: (date: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onJumpToToday: () => void;
  onSwitchRoutine: (template: RoutineTemplate) => void;
  onUpdateSetValue: (
    exIndex: number,
    setIndex: number,
    field: "weightLbs" | "reps",
    delta: number
  ) => void;
  onDirectSetInput: (
    exIndex: number,
    setIndex: number,
    field: "weightLbs" | "reps",
    value: number
  ) => void;
  onToggleSet: (exIndex: number, setIndex: number) => void;
  onOpenAddExercise: () => void;
  prCelebration?: string | null;
}

const REST_PRESETS = [
  { label: "60s", seconds: 60 },
  { label: "90s", seconds: 90 },
  { label: "2m", seconds: 120 },
  { label: "3m", seconds: 180 },
];

export function WorkoutSession({
  selectedDate,
  todayStr,
  scheduledDay,
  routineName,
  activeExercises,
  onSelectDate,
  onPrevDay,
  onNextDay,
  onJumpToToday,
  onSwitchRoutine,
  onUpdateSetValue,
  onDirectSetInput,
  onToggleSet,
  onOpenAddExercise,
  prCelebration,
}: WorkoutSessionProps) {
  // Rest Timer State
  const [restPresetSeconds, setRestPresetSeconds] = useState<number>(90);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number>(90);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sound chime & haptic feedback when timer hits 0
  const triggerChimeAndHaptic = () => {
    try {
      if (typeof window !== "undefined") {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = "sine";
          // High crisp Apple Health notification tone
          osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(1760, audioCtx.currentTime + 0.3); // A6
          gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.6);
        }
      }
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    } catch {
      // Audio or vibration unavailable
    }
  };

  // Timer Tick Hook
  useEffect(() => {
    if (isTimerRunning && restSecondsRemaining > 0) {
      timerIntervalRef.current = setInterval(() => {
        setRestSecondsRemaining((prev) => {
          if (prev <= 1) {
            triggerChimeAndHaptic();
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

  const handleSelectPreset = (seconds: number) => {
    setRestPresetSeconds(seconds);
    setRestSecondsRemaining(seconds);
  };

  const handleToggleTimer = () => {
    if (isTimerRunning) {
      setIsTimerRunning(false);
    } else {
      if (restSecondsRemaining <= 0) {
        setRestSecondsRemaining(restPresetSeconds);
      }
      setIsTimerRunning(true);
    }
  };

  const handleResetTimer = () => {
    setIsTimerRunning(false);
    setRestSecondsRemaining(restPresetSeconds);
  };

  // When a set is toggled, also auto-start the rest timer if set was completed
  const handleSetToggleWithTimer = (exIndex: number, setIndex: number) => {
    const targetSet = activeExercises[exIndex]?.sets[setIndex];
    const willBeCompleted = targetSet ? !targetSet.completed : false;

    onToggleSet(exIndex, setIndex);

    if (willBeCompleted) {
      setRestSecondsRemaining(restPresetSeconds);
      setIsTimerRunning(true);
    }
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

  return (
    <div className="space-y-5">
      {/* PR Celebration Floating Banner */}
      {prCelebration && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[110] bg-[#30D158] text-black px-6 py-3 rounded-2xl shadow-2xl font-black text-sm flex items-center space-x-2 animate-bounce">
          <Trophy className="w-5 h-5 stroke-[2.5]" />
          <span>{prCelebration}</span>
        </div>
      )}

      {/* =========================================================================
          COLLISION-PROOF ROUTINE & DATE BAR (Stacked / Overflow-Safe Flex)
          ========================================================================= */}
      <div className="p-3 sm:p-4 rounded-2xl bg-[#1C1C1E] border border-[#2C2C2E]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        {/* Date Selector Controls */}
        <div className="flex items-center space-x-1.5 overflow-x-auto min-w-0">
          <button
            type="button"
            onClick={onPrevDay}
            className="p-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors flex-shrink-0"
            title="Previous Day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <label className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-[#2C2C2E] cursor-pointer hover:border-[#0A84FF] transition-colors flex-shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#0A84FF]" />
            <span className="text-xs font-bold text-white font-mono">
              {formatFullDate(selectedDate)}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onSelectDate(e.target.value)}
              className="sr-only"
            />
          </label>

          {selectedDate === todayStr ? (
            <span className="px-2 py-0.5 rounded-md bg-[#0A84FF]/20 text-[#0A84FF] text-[10px] font-bold font-mono flex-shrink-0">
              TODAY
            </span>
          ) : (
            <button
              type="button"
              onClick={onJumpToToday}
              className="px-2.5 py-1 rounded-md bg-[#2C2C2E] text-[11px] font-semibold text-gray-300 hover:text-white transition-colors flex-shrink-0"
            >
              Today
            </button>
          )}

          <button
            type="button"
            onClick={onNextDay}
            className="p-2 rounded-xl bg-[#2C2C2E] text-[#8E8E93] hover:text-white transition-colors flex-shrink-0"
            title="Next Day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Routine Switcher Dropdown (Full width on narrow mobile, auto on desktop) */}
        <div className="w-full sm:w-auto">
          <select
            value={
              Object.entries(ROUTINE_TEMPLATES).find(
                ([, t]) => t.name === scheduledDay?.routineName
              )?.[0] || "custom"
            }
            onChange={(e) => {
              const template = ROUTINE_TEMPLATES[e.target.value];
              if (template) onSwitchRoutine(template);
            }}
            className="w-full sm:w-auto bg-[#2C2C2E] border border-[#38383A] rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-[#0A84FF] transition-colors"
          >
            {Object.entries(ROUTINE_TEMPLATES).map(([key, template]) => (
              <option key={key} value={key} className="bg-[#1C1C1E]">
                {template.name.split("(")[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* =========================================================================
          ROUTINE INFO CARD & OVERHAULED "SET REST TIMER" HUD
          ========================================================================= */}
      <div className="p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Routine Title and Muscle Group Badges */}
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0A84FF]">
              {selectedDate === todayStr ? "Today's Target Session" : "Prescribed Session"}
            </span>
            {scheduledDay?.focusMuscleGroups && (
              <div className="flex flex-wrap items-center gap-1">
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

        {/* OVERHAULED "Set Rest Timer" Capsule */}
        <div className="p-3 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex flex-col sm:flex-row sm:items-center gap-3 flex-shrink-0">
          <div>
            <div className="flex items-center space-x-1.5 mb-1.5">
              <Timer className="w-3.5 h-3.5 text-[#0A84FF]" />
              <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">
                Set Rest Timer
              </span>
            </div>

            {/* Quick Preset Pills [ 60s | 90s | 2m | 3m ] */}
            <div className="flex items-center space-x-1">
              {REST_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  type="button"
                  onClick={() => handleSelectPreset(preset.seconds)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition-all ${
                    restPresetSeconds === preset.seconds
                      ? "bg-[#0A84FF] text-white shadow-sm"
                      : "bg-[#1C1C1E] text-[#8E8E93] hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Digital MM:SS and Controls */}
          <div className="flex items-center justify-between sm:justify-end space-x-3 pt-2 sm:pt-0 sm:pl-3 sm:border-l border-[#38383A]">
            <div
              className={`text-xl font-bold font-mono tracking-tight ${
                isTimerRunning ? "text-[#30D158] animate-pulse" : "text-white"
              }`}
            >
              {formatTimer(restSecondsRemaining)}
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={handleToggleTimer}
                className={`p-2 rounded-xl text-white font-bold transition-all active:scale-95 ${
                  isTimerRunning ? "bg-[#FF9500] text-black" : "bg-[#0A84FF] hover:bg-[#0A84FF]/90"
                }`}
                title={isTimerRunning ? "Pause Timer" : "Start Rest Timer"}
              >
                {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={handleResetTimer}
                className="p-2 rounded-xl bg-[#1C1C1E] text-[#8E8E93] hover:text-white transition-colors active:scale-95"
                title="Reset Timer to Preset"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          REST DAY OR ACTIVE EXERCISES LIST
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
              Muscles grow during recovery. Hit your protein and calorie targets today for optimal tissue repair.
            </p>
          </div>

          <div className="pt-2">
            <p className="text-xs text-[#8E8E93] mb-2 font-medium">Want to train anyway?</p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-md mx-auto">
              {Object.entries(ROUTINE_TEMPLATES)
                .filter(([k]) => k !== "rest")
                .map(([key, t]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onSwitchRoutine(t)}
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

              {/* Grouped Set Table Rows with Enlarged Controls */}
              <div className="divide-y divide-[#2C2C2E]">
                {/* Table Header */}
                <div className="grid grid-cols-12 text-[10px] font-semibold uppercase text-[#8E8E93] pb-2 px-1 font-mono">
                  <div className="col-span-2">Set</div>
                  <div className="col-span-3 sm:col-span-4">Previous</div>
                  <div className="col-span-4 sm:col-span-3 text-center">Weight</div>
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
                    {/* Set Number */}
                    <div className="col-span-2 flex items-center space-x-1 font-mono text-xs font-bold text-white">
                      <span>#{set.setNumber}</span>
                      {set.isPr && (
                        <span className="text-[8px] bg-[#0A84FF]/20 text-[#0A84FF] px-1 rounded font-bold">
                          PR
                        </span>
                      )}
                    </div>

                    {/* Previous Benchmark */}
                    <div className="col-span-3 sm:col-span-4 text-xs font-mono text-[#8E8E93] truncate pr-1">
                      {set.prevWeightLbs !== null && set.prevReps !== null ? (
                        `${set.prevWeightLbs} lbs × ${set.prevReps}`
                      ) : (
                        <span className="text-[#8E8E93]/60 italic">Day 1</span>
                      )}
                    </div>

                    {/* Weight Stepper & Direct Input */}
                    <div className="col-span-4 sm:col-span-3 flex items-center justify-center space-x-1 font-mono">
                      <button
                        type="button"
                        onClick={() => onUpdateSetValue(exIndex, setIndex, "weightLbs", -5)}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-[#2C2C2E] text-white hover:bg-[#38383A] active:scale-95 flex items-center justify-center text-sm font-bold transition-all"
                        aria-label="Decrease weight"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={set.weightLbs || ""}
                        placeholder="0"
                        onChange={(e) =>
                          onDirectSetInput(
                            exIndex,
                            setIndex,
                            "weightLbs",
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-14 py-1 text-center text-xs font-bold font-mono text-white bg-[#1C1C1E] border border-[#38383A] rounded-lg focus:outline-none focus:border-[#0A84FF]"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateSetValue(exIndex, setIndex, "weightLbs", 5)}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-[#2C2C2E] text-white hover:bg-[#38383A] active:scale-95 flex items-center justify-center text-sm font-bold transition-all"
                        aria-label="Increase weight"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Reps Stepper & Direct Input */}
                    <div className="col-span-2 flex items-center justify-center space-x-1 font-mono">
                      <button
                        type="button"
                        onClick={() => onUpdateSetValue(exIndex, setIndex, "reps", -1)}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-[#2C2C2E] text-white hover:bg-[#38383A] active:scale-95 flex items-center justify-center text-sm font-bold transition-all"
                        aria-label="Decrease reps"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={set.reps || ""}
                        placeholder="0"
                        onChange={(e) =>
                          onDirectSetInput(
                            exIndex,
                            setIndex,
                            "reps",
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-11 py-1 text-center text-xs font-bold font-mono text-white bg-[#1C1C1E] border border-[#38383A] rounded-lg focus:outline-none focus:border-[#0A84FF]"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateSetValue(exIndex, setIndex, "reps", 1)}
                        className="min-w-[36px] min-h-[36px] rounded-xl bg-[#2C2C2E] text-white hover:bg-[#38383A] active:scale-95 flex items-center justify-center text-sm font-bold transition-all"
                        aria-label="Increase reps"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Circular Checkmark Button (Turns Apple Green #30D158 and Auto-Starts Timer) */}
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => handleSetToggleWithTimer(exIndex, setIndex)}
                        className={`min-w-[36px] min-h-[36px] rounded-full flex items-center justify-center transition-all ${
                          set.completed
                            ? "bg-[#30D158] text-black shadow-md shadow-[#30D158]/30 font-bold"
                            : "border-2 border-[#38383A] text-transparent hover:border-[#0A84FF]"
                        }`}
                        title={set.completed ? "Set Completed" : "Mark Set Complete"}
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
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
              type="button"
              onClick={onOpenAddExercise}
              className="px-5 py-2.5 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-xs font-semibold text-white flex items-center space-x-2 transition-all active:scale-95 shadow-md"
            >
              <Plus className="w-4 h-4 text-[#0A84FF]" />
              <span>Add Exercise to Session</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkoutSession;
