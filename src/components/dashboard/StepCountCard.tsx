"use client";

import React from "react";
import { Footprints, ChevronRight, TrendingUp } from "lucide-react";

export interface StepCountCardProps {
  steps?: number;
  distanceKm?: number;
  targetSteps?: number;
  onOpenSyncGuide?: () => void;
}

export function StepCountCard({
  steps = 0,
  distanceKm,
  targetSteps = 10000,
  onOpenSyncGuide,
}: StepCountCardProps) {
  const percentage = Math.min(100, Math.round((steps / targetSteps) * 100));
  const isTargetMet = steps >= targetSteps;

  return (
    <div
      onClick={onOpenSyncGuide}
      className="p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 shadow-lg shadow-black/40 flex flex-col justify-between cursor-pointer group min-h-[160px]"
    >
      {/* Header: Squircle Badge + Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#FF9500]/10">
            <Footprints className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#FF9500] uppercase tracking-wider block">
              Steps & Distance
            </span>
            <span className="text-[10px] text-[#8E8E93] font-mono">Apple HealthKit</span>
          </div>
        </div>

        <div className="text-[#8E8E93] group-hover:text-white transition-colors">
          <ChevronRight className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>

      {/* Main Metric Readout */}
      <div className="my-2.5">
        <div className="flex items-baseline space-x-1.5">
          <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
            {steps > 0 ? steps.toLocaleString() : "0"}
          </span>
          <span className="text-xs font-semibold text-[#8E8E93] uppercase font-mono">
            steps
          </span>
        </div>

        {/* Horizontal Mini Progress Bar toward 10k Goal */}
        <div className="mt-2 space-y-1">
          <div className="w-full h-1.5 rounded-full bg-[#2C2C2E] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isTargetMet
                  ? "bg-[#30D158]"
                  : "bg-gradient-to-r from-[#FF9500] to-[#FF2D55]"
              }`}
              style={{ width: `${Math.max(4, percentage)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-[#8E8E93]">
            <span>{percentage}% of 10k goal</span>
            <span>{distanceKm ? `${distanceKm} km` : `${(steps * 0.00076).toFixed(1)} km`}</span>
          </div>
        </div>
      </div>

      {/* Footer Status Pill */}
      <div className="pt-2 border-t border-[#2C2C2E] flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8E8E93]">Daily Target</span>
        <span className={isTargetMet ? "text-[#30D158] font-bold" : "text-white"}>
          {isTargetMet ? "Goal Crushed! 🎉" : `${(targetSteps - steps).toLocaleString()} left`}
        </span>
      </div>
    </div>
  );
}

export default StepCountCard;
