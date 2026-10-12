"use client";

import React from "react";
import { Moon, ChevronRight, Sparkles } from "lucide-react";

export interface SleepAnalysisCardProps {
  sleepHours?: number;
  deepSleepHours?: number;
  onOpenSyncGuide?: () => void;
}

export function SleepAnalysisCard({
  sleepHours = 0,
  deepSleepHours,
  onOpenSyncGuide,
}: SleepAnalysisCardProps) {
  // Format hours into h & m
  const formatDuration = (hoursTotal: number) => {
    if (!hoursTotal || hoursTotal <= 0) return "0h 0m";
    const h = Math.floor(hoursTotal);
    const m = Math.round((hoursTotal - h) * 60);
    return `${h}h ${m}m`;
  };

  const isAdequateSleep = sleepHours >= 7;

  return (
    <div
      onClick={onOpenSyncGuide}
      className="p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 shadow-lg shadow-black/40 flex flex-col justify-between cursor-pointer group min-h-[160px]"
    >
      {/* Header: Squircle Badge + Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#64D2FF]/15 text-[#64D2FF] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#64D2FF]/10">
            <Moon className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#64D2FF] uppercase tracking-wider block">
              Sleep Analysis
            </span>
            <span className="text-[10px] text-[#8E8E93] font-mono">Recovery Engine</span>
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
            {sleepHours > 0 ? formatDuration(sleepHours) : "0h 0m"}
          </span>
          <span className="text-xs font-semibold text-[#8E8E93] uppercase font-mono">
            asleep
          </span>
        </div>

        {/* Deep Sleep Breakdown */}
        <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
          <div className="flex items-center space-x-1 text-[#8E8E93]">
            <span className="w-2 h-2 rounded-full bg-[#64D2FF]" />
            <span>Deep Sleep:</span>
          </div>
          <span className="text-white font-semibold">
            {deepSleepHours && deepSleepHours > 0
              ? formatDuration(deepSleepHours)
              : sleepHours > 0
              ? formatDuration(sleepHours * 0.22)
              : "—"}
          </span>
        </div>
      </div>

      {/* Footer Recovery Pill */}
      <div className="pt-2 border-t border-[#2C2C2E] flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8E8E93]">Tissue Recovery</span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            isAdequateSleep
              ? "bg-[#30D158]/15 text-[#30D158]"
              : sleepHours > 0
              ? "bg-amber-500/15 text-amber-400"
              : "bg-[#2C2C2E] text-[#8E8E93]"
          }`}
        >
          {isAdequateSleep
            ? "Optimal Rest"
            : sleepHours > 0
            ? "Sub-Optimal (<7h)"
            : "No Sync Data"}
        </span>
      </div>
    </div>
  );
}

export default SleepAnalysisCard;
