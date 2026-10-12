"use client";

import React from "react";
import { Flame, ChevronRight, Zap } from "lucide-react";

export interface TotalBurnCardProps {
  totalBurnKcal?: number;
  activeBurnKcal?: number;
  basalBurnKcal?: number;
  consumedCalories?: number;
  targetCalories?: number;
  onOpenSyncGuide?: () => void;
}

export function TotalBurnCard({
  totalBurnKcal,
  activeBurnKcal = 0,
  basalBurnKcal = 0,
  consumedCalories = 0,
  targetCalories = 2600,
  onOpenSyncGuide,
}: TotalBurnCardProps) {
  // If total is not explicitly passed, compute active + basal
  const computedTotal =
    totalBurnKcal && totalBurnKcal > 0
      ? totalBurnKcal
      : activeBurnKcal + basalBurnKcal;

  const netEnergyBalance =
    consumedCalories > 0 && computedTotal > 0
      ? consumedCalories - computedTotal
      : null;

  return (
    <div
      onClick={onOpenSyncGuide}
      className="p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 shadow-lg shadow-black/40 flex flex-col justify-between cursor-pointer group min-h-[160px]"
    >
      {/* Header: Squircle Badge + Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#FF9500]/10">
            <Flame className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div>
            <span className="text-xs font-semibold text-[#FF9500] uppercase tracking-wider block">
              Total Daily Burn
            </span>
            <span className="text-[10px] text-[#8E8E93] font-mono">Active + Basal BMR</span>
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
            {computedTotal > 0 ? Math.round(computedTotal).toLocaleString() : "—"}
          </span>
          <span className="text-xs font-semibold text-[#8E8E93] uppercase font-mono">
            kcal burned
          </span>
        </div>

        {/* Active vs Basal Sub-Readout */}
        <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#8E8E93]">
          <span>
            Active:{" "}
            <strong className="text-[#FF9500]">
              {activeBurnKcal > 0 ? `${Math.round(activeBurnKcal)} kcal` : "—"}
            </strong>
          </span>
          <span>
            Basal:{" "}
            <strong className="text-gray-300">
              {basalBurnKcal > 0 ? `${Math.round(basalBurnKcal)} kcal` : "—"}
            </strong>
          </span>
        </div>
      </div>

      {/* Footer Energy Balance Comparison */}
      <div className="pt-2 border-t border-[#2C2C2E] flex items-center justify-between text-[11px] font-mono">
        <span className="text-[#8E8E93]">Net Balance</span>
        {netEnergyBalance !== null ? (
          <span
            className={`font-bold ${
              netEnergyBalance >= 150
                ? "text-[#30D158]"
                : netEnergyBalance >= 0
                ? "text-[#0A84FF]"
                : "text-[#FF453A]"
            }`}
          >
            {netEnergyBalance >= 0 ? `+${Math.round(netEnergyBalance)}` : Math.round(netEnergyBalance)} kcal
            {netEnergyBalance >= 150 ? " (Bulking)" : netEnergyBalance >= 0 ? " (Maint)" : " (Deficit)"}
          </span>
        ) : (
          <span className="text-[#8E8E93]">Log food to compare</span>
        )}
      </div>
    </div>
  );
}

export default TotalBurnCard;
