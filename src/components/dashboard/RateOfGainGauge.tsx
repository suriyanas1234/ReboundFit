"use client";

import React from "react";
import { GainZone } from "@/algorithms/weightTrend";
import { CheckCircle2, AlertTriangle, ShieldAlert, Clock } from "lucide-react";

interface RateOfGainGaugeProps {
  rateOfGainLbsPerWeek: number;
  gainZone: GainZone;
  targetGainRateLbsPerWeek: number;
  dataPointsCount: number;
}

export function RateOfGainGauge({
  rateOfGainLbsPerWeek,
  gainZone,
  targetGainRateLbsPerWeek,
  dataPointsCount,
}: RateOfGainGaugeProps) {
  const hasEnoughData = dataPointsCount >= 3;

  // Speedometer ranges:
  // -0.25 to +0.85 lbs/week -> map to percentage 0% to 100%
  const minRate = -0.25;
  const maxRate = 0.85;
  const clampedRate = Math.max(minRate, Math.min(maxRate, rateOfGainLbsPerWeek));
  const needlePercent = hasEnoughData ? ((clampedRate - minRate) / (maxRate - minRate)) * 100 : 50;

  const getZoneMeta = (zone: GainZone) => {
    switch (zone) {
      case "sweet_spot":
        return {
          label: "SWEET SPOT",
          colorText: "text-brand-emerald",
          bgColor: "bg-brand-emerald/10",
          borderColor: "border-brand-emerald/30",
          description: "Optimal Hypertrophy: Maximum muscle gain with minimal fat accumulation.",
          icon: CheckCircle2,
        };
      case "mild_gain":
        return {
          label: "CONSERVATIVE BULK",
          colorText: "text-brand-cyan",
          bgColor: "bg-brand-cyan/10",
          borderColor: "border-brand-cyan/30",
          description: "Lean Accretion: Conservative pace, very low adipose risk.",
          icon: CheckCircle2,
        };
      case "stagnant":
      case "loss":
        return {
          label: "UNDER-FUELING / STAGNANT",
          colorText: "text-brand-amber",
          bgColor: "bg-brand-amber/10",
          borderColor: "border-brand-amber/30",
          description: "Under-surplus: Weight gain has stalled. Risk of limiting muscle recovery.",
          icon: AlertTriangle,
        };
      case "excess_gain":
      case "rapid_gain":
        return {
          label: "EXCESS GAIN",
          colorText: "text-brand-rose",
          bgColor: "bg-brand-rose/10",
          borderColor: "border-brand-rose/30",
          description: "Surplus Ceiling Exceeded: Gaining faster than muscle protein synthesis limits.",
          icon: ShieldAlert,
        };
    }
  };

  const zoneMeta = getZoneMeta(gainZone);
  const StatusIcon = hasEnoughData ? zoneMeta.icon : Clock;

  return (
    <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute -right-16 -top-16 w-44 h-44 rounded-full bg-brand-cyan/5 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
            Speedometer
          </span>
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <span>Rate-of-Gain</span>
            <span className="text-xs font-normal text-gray-400">
              (Target: {targetGainRateLbsPerWeek > 0 ? `+${targetGainRateLbsPerWeek}` : "0.00"} lbs/wk)
            </span>
          </h3>
        </div>

        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
            hasEnoughData
              ? `${zoneMeta.bgColor} ${zoneMeta.borderColor} ${zoneMeta.colorText}`
              : "bg-surface-elevated border-surface-border text-gray-400"
          }`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span>{hasEnoughData ? zoneMeta.label : "CALCULATING"}</span>
        </div>
      </div>

      {/* Main Speedometer Gauge Graphic */}
      <div className="relative pt-4 pb-2">
        {/* Track Bar with colored gradient segments */}
        <div className="h-3 w-full rounded-full bg-surface-elevated overflow-hidden relative flex">
          <div className="w-[20%] bg-brand-amber/60" title="Stagnant (< 0.15)" />
          <div className="w-[15%] bg-brand-cyan/70" title="Mild Gain" />
          <div className="w-[35%] bg-brand-emerald" title="Sweet Spot (0.25 - 0.50)" />
          <div className="w-[30%] bg-brand-rose/70" title="Excess Gain (> 0.50)" />
        </div>

        {/* Dynamic Needle Marker */}
        <div
          className="absolute top-2 transition-all duration-500 ease-out flex flex-col items-center -translate-x-1/2"
          style={{ left: `${needlePercent}%` }}
        >
          <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-brand-cyan shadow-lg shadow-brand-cyan/50" />
          <div className="w-0.5 h-2 bg-brand-cyan" />
        </div>

        {/* Speedometer Labels */}
        <div className="flex justify-between text-[10px] font-mono text-gray-500 mt-2 px-1">
          <span>Stagnant</span>
          <span className="text-brand-emerald font-semibold">
            {targetGainRateLbsPerWeek > 0 ? `+${targetGainRateLbsPerWeek} lbs/wk (Goal)` : "Maintenance (Goal)"}
          </span>
          <span>Excess</span>
        </div>
      </div>

      {/* Current Value Display & Context */}
      <div className="mt-4 pt-4 border-t border-surface-border/60 flex items-center justify-between">
        {hasEnoughData ? (
          <>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black tracking-tight text-white font-mono">
                {rateOfGainLbsPerWeek >= 0 ? `+${rateOfGainLbsPerWeek.toFixed(2)}` : rateOfGainLbsPerWeek.toFixed(2)}
              </span>
              <span className="text-xs font-medium text-gray-400">lbs / week</span>
            </div>
            <p className="text-xs text-gray-400 max-w-[220px] text-right leading-tight">
              {zoneMeta.description}
            </p>
          </>
        ) : (
          <div className="w-full flex items-center justify-between">
            <span className="text-xs font-mono text-brand-cyan">
              {dataPointsCount === 0
                ? "0 weigh-ins recorded"
                : `${dataPointsCount} of 3 weigh-ins recorded`}
            </span>
            <p className="text-xs text-gray-400 text-right">
              Log 3+ morning weigh-ins to establish rate-of-gain slope.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
