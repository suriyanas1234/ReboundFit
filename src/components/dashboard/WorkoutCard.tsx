"use client";

import React from "react";
import Link from "next/link";
import { Dumbbell, ChevronRight, Play, CheckCircle2, Coffee, Clock } from "lucide-react";
import { LocalScheduledWorkout } from "@/lib/db";

interface WorkoutCardProps {
  workout: LocalScheduledWorkout | null;
  onStartSession?: () => void;
}

export function WorkoutCard({ workout, onStartSession }: WorkoutCardProps) {
  const isRestDay = workout?.dayType === "rest";
  const isCompleted = Boolean(workout?.isCompleted);

  return (
    <Link
      href="/lift"
      className="group block p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 active:scale-[0.99] shadow-lg shadow-black/40 min-h-[160px]"
    >
      {/* Card Header: Squircle Badge, Category Label, Time Badge */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
              isRestDay
                ? "bg-amber-500/15 text-amber-400 shadow-amber-500/10"
                : isCompleted
                ? "bg-[#30D158]/15 text-[#30D158] shadow-[#30D158]/10"
                : "bg-[#0A84FF]/15 text-[#0A84FF] shadow-[#0A84FF]/10"
            }`}
          >
            {isRestDay ? (
              <Coffee className="w-4 h-4 stroke-[2.2]" />
            ) : isCompleted ? (
              <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
            ) : (
              <Dumbbell className="w-4 h-4 stroke-[2.2]" />
            )}
          </div>

          <div className="min-w-0 truncate">
            <span
              className={`text-xs font-semibold tracking-wider uppercase block truncate ${
                isRestDay
                  ? "text-amber-400"
                  : isCompleted
                  ? "text-[#30D158]"
                  : "text-[#0A84FF]"
              }`}
            >
              {isRestDay
                ? "Rest & Recovery"
                : isCompleted
                ? "Session Completed"
                : "Active Hypertrophy Session"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 text-[#8E8E93] group-hover:text-white transition-colors text-xs font-mono flex-shrink-0">
          <span className="text-[11px] font-semibold tracking-wide flex items-center space-x-1">
            <Clock className="w-3 h-3 text-[#8E8E93]" />
            <span>{workout?.scheduledTime || "08:00 AM"}</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      </div>

      {/* Routine Headline */}
      <div className="mt-2 min-w-0">
        <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight truncate">
          {workout?.routineName || (isRestDay ? "Scheduled Rest & Growth Day" : "Progressive Overload Split")}
        </h3>
        <p className="text-xs text-[#8E8E93] mt-1 line-clamp-1 leading-relaxed">
          {workout?.notes ||
            (isRestDay
              ? "Muscles grow outside the gym. Hit surplus calories and protein synthesis targets."
              : "Focus on logbook progressive overload: beat reps or weight from prior session.")}
        </p>
      </div>

      {/* Muscle Focus Chips & Action Button Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-[#2C2C2E]">
        {/* Muscle Groups */}
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {workout?.focusMuscleGroups && workout.focusMuscleGroups.length > 0 ? (
            workout.focusMuscleGroups.slice(0, 3).map((group) => (
              <span
                key={group}
                className="px-2.5 py-0.5 rounded-lg bg-[#2C2C2E] border border-[#38383A]/40 text-[11px] font-mono uppercase text-gray-300 tracking-wider truncate"
              >
                {group}
              </span>
            ))
          ) : (
            <span className="text-[11px] font-mono text-[#8E8E93]">
              {isRestDay ? "Active Recovery" : "Compound Hypertrophy"}
            </span>
          )}
        </div>

        {/* Action Trigger Pill */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-[#30D158]/15 border border-[#30D158]/30 text-[#30D158] text-xs font-bold font-mono">
              <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Finished</span>
            </span>
          ) : isRestDay ? (
            <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono">
              <Coffee className="w-3.5 h-3.5" />
              <span>Rest Day</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#0A84FF] text-white text-xs font-bold shadow-md shadow-[#0A84FF]/25 group-hover:bg-[#0077ED] transition-colors">
              <Play className="w-3 h-3 fill-current" />
              <span>Start</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
