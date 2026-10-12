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
import { WorkoutSession } from "@/components/workout/WorkoutSession";
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
          <WorkoutSession
            selectedDate={selectedDate}
            todayStr={todayStr}
            scheduledDay={scheduledDay}
            routineName={routineName}
            activeExercises={activeExercises}
            onSelectDate={handleSelectDate}
            onPrevDay={handlePrevDay}
            onNextDay={handleNextDay}
            onJumpToToday={handleJumpToToday}
            onSwitchRoutine={handleSwitchRoutine}
            onUpdateSetValue={handleUpdateSetValue}
            onDirectSetInput={(exIndex, setIndex, field, value) => {
              const next = [...activeExercises];
              next[exIndex].sets[setIndex][field] = value;
              setActiveExercises(next);
            }}
            onToggleSet={handleToggleSet}
            onOpenAddExercise={() => setIsAddExerciseModalOpen(true)}
            prCelebration={prCelebration}
          />

          {/* Add Exercise Modal */}
          {isAddExerciseModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
              <div className="w-full max-w-md rounded-3xl bg-[#1C1C1E] border border-[#38383A] p-6 shadow-2xl space-y-4 max-h-[80vh] flex flex-col pb-safe">
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
