"use client";

import React from "react";
import Link from "next/link";
import { Flame, ChevronRight, UtensilsCrossed, Wheat, Droplets } from "lucide-react";

interface NutritionCardProps {
  consumedCalories?: number;
  targetCalories?: number;
  consumedProtein?: number;
  targetProtein?: number;
  consumedCarbs?: number;
  consumedFat?: number;
  targetCarbs?: number;
  targetFat?: number;
}

export function NutritionCard({
  consumedCalories = 0,
  targetCalories = 2600,
  consumedProtein = 0,
  targetProtein = 160,
  consumedCarbs = 0,
  consumedFat = 0,
  targetCarbs = 315,
  targetFat = 74,
}: NutritionCardProps) {
  const safeCalories = Math.max(0, Number(consumedCalories || 0));
  const safeTargetCalories = Math.max(1, Number(targetCalories || 2600));
  const safeProtein = Math.max(0, Number(consumedProtein || 0));
  const safeTargetProtein = Math.max(1, Number(targetProtein || 160));
  const safeCarbs = Math.max(0, Number(consumedCarbs || 0));
  const safeTargetCarbs = Math.max(1, Number(targetCarbs || 315));
  const safeFat = Math.max(0, Number(consumedFat || 0));
  const safeTargetFat = Math.max(1, Number(targetFat || 74));

  const caloriePercent = Math.min(100, Math.round((safeCalories / safeTargetCalories) * 100));
  const calorieRemainder = safeTargetCalories - safeCalories;
  const proteinPercent = Math.min(100, Math.round((safeProtein / safeTargetProtein) * 100));

  return (
    <Link
      href="/food"
      className="group block p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 active:scale-[0.99] shadow-lg shadow-black/40 min-h-[160px]"
    >
      {/* Card Header: Squircle Badge, Category Label, Disclosure */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#FF9500]/10">
            <Flame className="w-4 h-4 fill-current stroke-[2.2]" />
          </div>
          <div className="min-w-0 truncate">
            <span className="text-xs font-semibold text-[#FF9500] tracking-wider uppercase block truncate">
              Active Energy & Surplus
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1 text-[#8E8E93] group-hover:text-white transition-colors text-xs font-mono flex-shrink-0">
          <span className="text-[11px] font-semibold tracking-wide">TODAY</span>
          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </div>
      </div>

      {/* Hero Numbers: Calories Consumed vs Target */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-2">
        <div className="flex items-baseline space-x-1.5 min-w-0">
          <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans truncate">
            {safeCalories.toLocaleString()}
          </span>
          <span className="text-sm sm:text-base font-semibold text-[#8E8E93] whitespace-nowrap">
            / {safeTargetCalories.toLocaleString()} kcal
          </span>
        </div>

        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FF9500]/15 text-[#FF9500] font-mono flex-shrink-0">
          {caloriePercent}%
        </span>
      </div>

      {/* Apple Health Activity Bar Gauge */}
      <div className="w-full h-2.5 rounded-full bg-[#2C2C2E] overflow-hidden my-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#FF9500] via-[#FFB340] to-[#FFD60A] transition-all duration-700 ease-out"
          style={{ width: `${Math.max(4, caloriePercent)}%` }}
        />
      </div>

      {/* Dynamic Surplus / Deficit Status */}
      <div className="text-xs text-[#8E8E93] leading-relaxed mb-3 min-w-0 truncate">
        {calorieRemainder > 0 ? (
          <span>
            <strong className="text-white font-semibold">
              {calorieRemainder.toLocaleString()} kcal
            </strong>{" "}
            remaining to hit lean surplus
          </span>
        ) : (
          <span className="text-[#30D158] font-semibold">
            ✓ Target reached! +{Math.abs(calorieRemainder).toLocaleString()} kcal lean surplus
          </span>
        )}
      </div>

      {/* Macro Split Breakdown (Protein, Carbs, Fat) */}
      <div className="pt-3 border-t border-[#2C2C2E] grid grid-cols-3 gap-2">
        {/* Protein Macro Pill */}
        <div className="p-2 rounded-xl bg-[#2C2C2E]/60 border border-[#38383A]/30 flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5 text-[#FF2D55] mb-1">
            <UtensilsCrossed className="w-3 h-3 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Protein</span>
          </div>
          <div className="text-sm font-extrabold text-white font-mono truncate">
            {safeProtein}
            <span className="text-[10px] font-normal text-[#8E8E93] ml-0.5">/{safeTargetProtein}g</span>
          </div>
          <div className="w-full h-1 bg-[#1C1C1E] rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-[#FF2D55] rounded-full"
              style={{ width: `${proteinPercent}%` }}
            />
          </div>
        </div>

        {/* Carbs Macro Pill */}
        <div className="p-2 rounded-xl bg-[#2C2C2E]/60 border border-[#38383A]/30 flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5 text-[#30D158] mb-1">
            <Wheat className="w-3 h-3 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Carbs</span>
          </div>
          <div className="text-sm font-extrabold text-white font-mono truncate">
            {safeCarbs}
            <span className="text-[10px] font-normal text-[#8E8E93] ml-0.5">/{safeTargetCarbs}g</span>
          </div>
          <div className="w-full h-1 bg-[#1C1C1E] rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-[#30D158] rounded-full"
              style={{ width: `${Math.min(100, (safeCarbs / safeTargetCarbs) * 100)}%` }}
            />
          </div>
        </div>

        {/* Fat Macro Pill */}
        <div className="p-2 rounded-xl bg-[#2C2C2E]/60 border border-[#38383A]/30 flex flex-col min-w-0">
          <div className="flex items-center space-x-1.5 text-[#0A84FF] mb-1">
            <Droplets className="w-3 h-3 flex-shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">Fats</span>
          </div>
          <div className="text-sm font-extrabold text-white font-mono truncate">
            {safeFat}
            <span className="text-[10px] font-normal text-[#8E8E93] ml-0.5">/{safeTargetFat}g</span>
          </div>
          <div className="w-full h-1 bg-[#1C1C1E] rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-[#0A84FF] rounded-full"
              style={{ width: `${Math.min(100, (safeFat / safeTargetFat) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
