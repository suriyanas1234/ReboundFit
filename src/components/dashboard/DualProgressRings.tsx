"use client";

import React from "react";
import { Flame, Beef, Wheat, Droplets } from "lucide-react";

interface DualProgressRingsProps {
  consumedCalories: number;
  targetCalories: number;
  consumedProtein: number;
  targetProtein: number;
  consumedCarbs: number;
  targetCarbs: number;
  consumedFat: number;
  targetFat: number;
}

export function DualProgressRings({
  consumedCalories,
  targetCalories,
  consumedProtein,
  targetProtein,
  consumedCarbs,
  targetCarbs,
  consumedFat,
  targetFat,
}: DualProgressRingsProps) {
  const safeCalories = Math.max(0, Number(consumedCalories || 0));
  const safeTargetCalories = Math.max(1, Number(targetCalories || 2600));
  const safeProtein = Math.max(0, Number(consumedProtein || 0));
  const safeTargetProtein = Math.max(1, Number(targetProtein || 160));
  const safeCarbs = Math.max(0, Number(consumedCarbs || 0));
  const safeTargetCarbs = Math.max(1, Number(targetCarbs || 315));
  const safeFat = Math.max(0, Number(consumedFat || 0));
  const safeTargetFat = Math.max(1, Number(targetFat || 74));

  // SVG Ring geometry
  const size = 200;
  const strokeWidth = 12;

  // Calorie ring (outer)
  const radiusCal = (size - strokeWidth) / 2;
  const circumferenceCal = 2 * Math.PI * radiusCal;
  const calPercent = Math.min(100, Math.max(0, (safeCalories / safeTargetCalories) * 100));
  const strokeDashoffsetCal = isNaN(calPercent) ? circumferenceCal : circumferenceCal - (calPercent / 100) * circumferenceCal;

  // Protein ring (inner)
  const radiusPro = radiusCal - strokeWidth - 6;
  const circumferencePro = 2 * Math.PI * radiusPro;
  const proPercent = Math.min(100, Math.max(0, (safeProtein / safeTargetProtein) * 100));
  const strokeDashoffsetPro = isNaN(proPercent) ? circumferencePro : circumferencePro - (proPercent / 100) * circumferencePro;

  const remainingCalories = Math.max(0, safeTargetCalories - safeCalories);
  const remainingProtein = Math.max(0, safeTargetProtein - safeProtein);

  return (
    <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
            Daily Targets
          </span>
          <h3 className="text-lg font-bold text-white">Fueling Rings</h3>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-cyan" />
            <span className="text-gray-300">Calories</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-emerald" />
            <span className="text-gray-300">Protein</span>
          </div>
        </div>
      </div>

      {/* Rings & Center Stats */}
      <div className="flex flex-col sm:flex-row items-center justify-around py-4 gap-6">
        <div className="relative w-[200px] h-[200px] flex items-center justify-center flex-shrink-0">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Calorie Background Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radiusCal}
              stroke="#1A1D27"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Calorie Active Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radiusCal}
              stroke="#00F0FF"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumferenceCal}
              strokeDashoffset={strokeDashoffsetCal}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />

            {/* Protein Background Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radiusPro}
              stroke="#1A1D27"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Protein Active Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radiusPro}
              stroke="#10B981"
              strokeWidth={strokeWidth}
              fill="transparent"
              strokeDasharray={circumferencePro}
              strokeDashoffset={strokeDashoffsetPro}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-white font-mono leading-none">
              {remainingCalories}
            </span>
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 mt-1">
              kcal left
            </span>
            <div className="mt-1.5 px-2 py-0.5 rounded-full bg-brand-emerald/15 border border-brand-emerald/30 text-[10px] font-mono text-brand-emerald">
              {remainingProtein}g pro left
            </div>
          </div>
        </div>

        {/* Detailed Breakdown */}
        <div className="flex-1 w-full space-y-3">
          {/* Calories Row */}
          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/70 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-brand-cyan/15 text-brand-cyan">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Calories</div>
                <div className="text-sm font-bold text-white font-mono">
                  {consumedCalories} / {targetCalories} kcal
                </div>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-brand-cyan">
              {calPercent.toFixed(0)}%
            </div>
          </div>

          {/* Protein Row */}
          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/70 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-brand-emerald/15 text-brand-emerald">
                <Beef className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs text-gray-400">Protein (Muscle Synthesis)</div>
                <div className="text-sm font-bold text-white font-mono">
                  {consumedProtein}g / {targetProtein}g
                </div>
              </div>
            </div>
            <div className="text-xs font-mono font-bold text-brand-emerald">
              {proPercent.toFixed(0)}%
            </div>
          </div>

          {/* Carbs & Fats Row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-surface-border/50">
              <div className="flex items-center space-x-1.5 text-gray-400 text-[11px] mb-0.5">
                <Wheat className="w-3 h-3 text-amber-400" />
                <span>Carbs</span>
              </div>
              <div className="text-xs font-mono font-semibold text-white">
                {consumedCarbs}g / {targetCarbs}g
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-surface-elevated/60 border border-surface-border/50">
              <div className="flex items-center space-x-1.5 text-gray-400 text-[11px] mb-0.5">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span>Fats</span>
              </div>
              <div className="text-xs font-mono font-semibold text-white">
                {consumedFat}g / {targetFat}g
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
