"use client";

import React from "react";
import { Check } from "lucide-react";

export interface WorkoutSetRowProps {
  setNumber: number;
  prevWeightLbs: number | null;
  prevReps: number | null;
  weightLbs: number;
  reps: number;
  completed: boolean;
  isPr?: boolean;
  onWeightChange: (val: number) => void;
  onRepsChange: (val: number) => void;
  onToggleComplete: () => void;
}

/**
 * Modern Fitness App Set Row (Strong / Hevy / Apple Health HIG)
 * Clean 5-column grid layout without overlapping stepper buttons.
 * Column 1: Set # (col-span-1)
 * Column 2: Previous (col-span-3)
 * Column 3: Weight in lbs (col-span-3)
 * Column 4: Reps (col-span-3)
 * Column 5: Done Checkmark (col-span-2)
 */
export function WorkoutSetRow({
  setNumber,
  prevWeightLbs,
  prevReps,
  weightLbs,
  reps,
  completed,
  isPr,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
}: WorkoutSetRowProps) {
  return (
    <div
      className={`grid grid-cols-12 items-center gap-1 py-2.5 px-1 rounded-xl transition-colors ${
        completed ? "bg-[#30D158]/5" : "hover:bg-[#2C2C2E]/30"
      }`}
    >
      {/* 1. Set # (col-span-1) */}
      <div className="col-span-1 flex items-center space-x-1 font-mono text-xs font-bold text-white">
        <span>{setNumber}</span>
        {isPr && (
          <span className="text-[8px] bg-[#0A84FF]/20 text-[#0A84FF] px-1 rounded font-bold">
            PR
          </span>
        )}
      </div>

      {/* 2. Previous Benchmark (col-span-3) */}
      <div className="col-span-3 text-xs font-mono text-[#8E8E93] truncate pr-1">
        {prevWeightLbs !== null && prevReps !== null ? (
          `${prevWeightLbs} × ${prevReps}`
        ) : (
          <span className="text-[#8E8E93]/50 italic">—</span>
        )}
      </div>

      {/* 3. Weight Input Box (col-span-3) - iOS native decimal keyboard */}
      <div className="col-span-3 px-0.5">
        <input
          type="number"
          step="any"
          inputMode="decimal"
          placeholder="lbs"
          value={weightLbs > 0 ? weightLbs : ""}
          onChange={(e) => onWeightChange(parseFloat(e.target.value) || 0)}
          className="w-full h-10 text-center text-sm font-bold font-mono text-white bg-[#2C2C2E] border border-[#38383A] rounded-xl focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] transition-colors placeholder:text-[#8E8E93]/40"
        />
      </div>

      {/* 4. Reps Input Box (col-span-3) - iOS native integer keypad */}
      <div className="col-span-3 px-0.5">
        <input
          type="number"
          step="1"
          inputMode="numeric"
          placeholder="reps"
          value={reps > 0 ? reps : ""}
          onChange={(e) => onRepsChange(parseInt(e.target.value, 10) || 0)}
          className="w-full h-10 text-center text-sm font-bold font-mono text-white bg-[#2C2C2E] border border-[#38383A] rounded-xl focus:outline-none focus:border-[#0A84FF] focus:ring-1 focus:ring-[#0A84FF] transition-colors placeholder:text-[#8E8E93]/40"
        />
      </div>

      {/* 5. Circular Tap Checkmark Button (col-span-2) */}
      <div className="col-span-2 flex justify-center">
        <button
          type="button"
          onClick={onToggleComplete}
          className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 ${
            completed
              ? "bg-[#30D158] text-black shadow-md shadow-[#30D158]/30 font-bold"
              : "bg-[#2C2C2E] border border-[#38383A] text-[#8E8E93] hover:text-white hover:border-[#0A84FF]"
          }`}
          title={completed ? "Set Completed" : "Mark Set Complete"}
          aria-label={completed ? `Set ${setNumber} completed` : `Mark set ${setNumber} complete`}
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

export default WorkoutSetRow;
