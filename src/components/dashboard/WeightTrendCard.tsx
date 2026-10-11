"use client";

import React from "react";
import Link from "next/link";
import { Scale, ChevronRight, TrendingUp, Plus } from "lucide-react";
import { SmoothedWeightPoint } from "@/algorithms/weightTrend";

interface WeightTrendCardProps {
  trendWeightLbs?: number;
  rateOfGainLbsPerWeek?: number;
  targetGainRateLbsPerWeek?: number;
  trendData?: SmoothedWeightPoint[];
  gainZone?: string;
  onOpenWeighIn?: () => void;
}

export function WeightTrendCard({
  trendWeightLbs = 0,
  rateOfGainLbsPerWeek = 0,
  targetGainRateLbsPerWeek = 0.35,
  trendData = [],
  gainZone = "sweet_spot",
  onOpenWeighIn,
}: WeightTrendCardProps) {
  const safeTrendWeight = Number(trendWeightLbs || 0);
  const safeRateOfGain = Number(rateOfGainLbsPerWeek || 0);
  const safeTargetGain = Number(targetGainRateLbsPerWeek || 0.35);

  // Sparkline data preparation: 7 points
  const recentPoints = Array.isArray(trendData) && trendData.length > 0 ? trendData.slice(-7) : [];
  
  // Extract strictly valid numeric weights
  const validWeights = recentPoints
    .map((p) => Number(p?.trendWeightLbs ?? p?.rawWeightLbs ?? 0))
    .filter((w) => !isNaN(w) && w > 0);

  const minW = validWeights.length > 0 ? Math.min(...validWeights) : Math.max(1, safeTrendWeight - 1);
  const maxW = validWeights.length > 0 ? Math.max(...validWeights) : safeTrendWeight + 1;
  const weightSpan = Math.max(0.5, maxW - minW);

  // Day labels for 7 days
  const dayLabels = recentPoints.map((p) => {
    try {
      if (!p?.date) return "•";
      const d = new Date(p.date + "T12:00:00");
      return d.toLocaleDateString("en-US", { weekday: "narrow" }); // M, T, W...
    } catch {
      return "•";
    }
  });

  const isSweetSpot =
    gainZone === "sweet_spot" || (safeRateOfGain >= 0.2 && safeRateOfGain <= 0.5);

  return (
    <div className="group block p-4 sm:p-5 rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/80 hover:border-[#38383A] transition-all duration-200 shadow-lg shadow-black/40 min-h-[160px]">
      {/* Card Header: Squircle Badge, Category Label, Disclosure */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <Link href="/vault" className="flex items-center space-x-3 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-lg bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#AF52DE]/10">
            <Scale className="w-4 h-4 stroke-[2.2]" />
          </div>
          <div className="min-w-0 truncate">
            <span className="text-xs font-semibold text-[#AF52DE] tracking-wider uppercase block truncate">
              Body Weight Trend
            </span>
          </div>
        </Link>

        <div className="flex items-center space-x-2 flex-shrink-0">
          {onOpenWeighIn && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onOpenWeighIn();
              }}
              className="px-2.5 py-1 rounded-full bg-[#AF52DE]/15 hover:bg-[#AF52DE]/25 text-[#AF52DE] text-[11px] font-bold flex items-center space-x-1 active:scale-95 transition-all"
            >
              <Plus className="w-3 h-3 stroke-[3]" />
              <span>Log</span>
            </button>
          )}

          <Link
            href="/vault"
            className="flex items-center space-x-1 text-[#8E8E93] group-hover:text-white transition-colors text-xs font-mono"
          >
            <span className="text-[11px] font-semibold tracking-wide">7-DAY EMA</span>
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </Link>
        </div>
      </div>

      {/* Main Metric: Smoothed Trend Weight & Rate Badge */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mt-2">
        <div className="flex items-baseline space-x-1.5 min-w-0">
          <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans truncate">
            {safeTrendWeight > 0 ? safeTrendWeight.toFixed(1) : "--.-"}
          </span>
          <span className="text-sm sm:text-base font-semibold text-[#8E8E93] whitespace-nowrap">
            lbs
          </span>
        </div>

        <span
          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold font-mono flex-shrink-0 ${
            isSweetSpot
              ? "bg-[#30D158]/15 text-[#30D158] border border-[#30D158]/20"
              : "bg-[#AF52DE]/15 text-[#AF52DE] border border-[#AF52DE]/20"
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          <span>
            {safeRateOfGain > 0
              ? `+${safeRateOfGain.toFixed(2)}`
              : safeRateOfGain.toFixed(2)}{" "}
            lbs/wk
          </span>
        </span>
      </div>

      {/* 7-Day Apple Health Trend Sparkline Bars */}
      <div className="pt-3 pb-1">
        <div className="flex items-end gap-1.5 h-12 w-full">
          {recentPoints.length > 0 ? (
            recentPoints.map((pt, i) => {
              const ptVal = Number(pt?.trendWeightLbs ?? pt?.rawWeightLbs ?? safeTrendWeight);
              const normalizedHeight = Math.max(
                16,
                Math.min(48, Math.round(((ptVal - minW) / weightSpan) * 36) + 12)
              );
              const isLatest = i === recentPoints.length - 1;

              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar">
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${
                      isLatest
                        ? "bg-[#AF52DE] shadow-md shadow-[#AF52DE]/30"
                        : "bg-[#AF52DE]/35 hover:bg-[#AF52DE]/60"
                    }`}
                    style={{ height: `${normalizedHeight}px` }}
                    title={`${pt?.date || ""}: ${ptVal.toFixed(1)} lbs`}
                  />
                  <span className="text-[10px] font-mono text-[#8E8E93] group-hover/bar:text-white">
                    {dayLabels[i] || "•"}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="w-full flex items-center justify-center text-xs text-[#8E8E93] font-mono py-2">
              Log daily weigh-in to render 7-day sparkline
            </div>
          )}
        </div>
      </div>

      {/* Footer Meta Row */}
      <div className="flex items-center justify-between text-xs text-[#8E8E93] pt-3 mt-1 border-t border-[#2C2C2E]">
        <span className="truncate">
          Target Gain:{" "}
          <strong className="text-white font-medium">+{safeTargetGain} lbs/wk</strong>
        </span>
        <span
          className={`text-[11px] font-semibold font-mono flex-shrink-0 ${
            isSweetSpot ? "text-[#30D158]" : "text-[#AF52DE]"
          }`}
        >
          {isSweetSpot ? "✓ Optimal Bulk Rate" : "Active Tracking"}
        </span>
      </div>
    </div>
  );
}
