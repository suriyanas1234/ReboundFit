"use client";

import React from "react";
import { Heart, ChevronRight, Activity } from "lucide-react";

export interface HeartRateCardProps {
  restingHeartRateBpm?: number;
  onOpenSyncGuide?: () => void;
}

export function HeartRateCard({
  restingHeartRateBpm = 0,
  onOpenSyncGuide,
}: HeartRateCardProps) {
  const getHeartRateCategory = (bpm: number) => {
    if (!bpm || bpm <= 0) return { label: "No Sync Data", color: "text-[#8E8E93]" };
    if (bpm < 60) return { label: "Athletic Range (<60)", color: "text-[#30D158]" };
    if (bpm <= 75) return { label: "Ideal Healthy Range", color: "text-[#0A84FF]" };
    if (bpm <= 85) return { label: "Average Range", color: "text-amber-400" };
    return { label: "Elevated Range", color: "text-[#FF453A]" };
  };

  const status = getHeartRateCategory(restingHeartRateBpm);

  return (
    <div
      onClick={onOpenSyncGuide}
      className="p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 shadow-lg shadow-black/40 flex flex-col justify-between cursor-pointer group min-h-[160px]"
    >
      {/* Header: Squircle Badge + Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF2D55]/15 text-[#FF2D55] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#FF2D55]/10">
            <Heart className="w-4 h-4 stroke-[2.2] fill-current" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#FF2D55] uppercase tracking-wider block">
              Resting Heart Rate
            </span>
            <span className="text-[10px] text-[#8E8E93] font-mono">Cardiovascular Vitals</span>
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
            {restingHeartRateBpm > 0 ? restingHeartRateBpm : "—"}
          </span>
          <span className="text-xs font-semibold text-[#8E8E93] uppercase font-mono">
            bpm
          </span>
        </div>

        {/* Pulse / Historical Range indicator */}
        <div className="mt-2 flex items-center space-x-2 text-[10px] font-mono text-[#8E8E93]">
          <Activity className="w-3 h-3 text-[#FF2D55] animate-pulse" />
          <span>
            {restingHeartRateBpm > 0
              ? `Range: ${restingHeartRateBpm - 4} – ${restingHeartRateBpm + 6} bpm`
              : "Awaiting Apple Watch sync"}
          </span>
        </div>
      </div>

      {/* Footer Category Pill */}
      <div className="pt-2 border-t border-[#2C2C2E] flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8E8E93]">Cardio Status</span>
        <span className={`font-semibold ${status.color}`}>
          {status.label}
        </span>
      </div>
    </div>
  );
}

export default HeartRateCard;
