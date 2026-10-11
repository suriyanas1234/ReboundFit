"use client";

import React from "react";
import { SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { TrendingUp, Plus, Scale, Sparkles } from "lucide-react";

interface WeightTrendChartProps {
  data: SmoothedWeightPoint[];
  onOpenWeighIn: () => void;
}

export function WeightTrendChart({ data, onOpenWeighIn }: WeightTrendChartProps) {
  // Empty State: 0 weigh-ins
  if (!data || data.length === 0) {
    return (
      <div className="rounded-3xl bg-surface border border-surface-border p-8 shadow-xl text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto text-brand-cyan">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-base font-bold text-white">No Weigh-Ins Logged Yet</h4>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 leading-relaxed">
            Step on the scale in the morning after waking up. Log your first weight to establish your baseline.
          </p>
        </div>
        <button
          onClick={onOpenWeighIn}
          className="inline-flex items-center space-x-2 px-5 py-2.5 bg-brand-cyan text-black rounded-2xl font-extrabold text-xs shadow-lg shadow-brand-cyan/20 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Log Day 1 Weigh-In</span>
        </button>
      </div>
    );
  }

  const latest = data[data.length - 1];
  const earliest = data[0];
  const deltaWeight = latest.trendWeightLbs - earliest.trendWeightLbs;

  // Single Point State: 1 baseline weigh-in recorded
  if (data.length === 1) {
    return (
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
                Baseline Established
              </span>
              <span className="px-2 py-0.5 rounded-full bg-brand-cyan/15 text-brand-cyan text-[10px] font-mono">
                Day 1
              </span>
            </div>
            <div className="flex items-baseline space-x-3 mt-1">
              <h3 className="text-2xl font-black text-white font-mono">
                {latest.rawWeightLbs.toFixed(1)} lbs
              </h3>
              <span className="text-xs text-gray-400 font-mono">Starting Weight</span>
            </div>
          </div>

          <button
            onClick={onOpenWeighIn}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/40 text-xs font-semibold text-white transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 text-brand-cyan" />
            <span>Update Today</span>
          </button>
        </div>

        <div className="p-6 rounded-2xl bg-surface-elevated/50 border border-dashed border-surface-border flex flex-col items-center justify-center text-center space-y-2">
          <Sparkles className="w-5 h-5 text-brand-cyan" />
          <p className="text-xs text-gray-300 font-medium">
            1 baseline weigh-in recorded ({latest.date})
          </p>
          <p className="text-[11px] text-gray-500 max-w-sm">
            Weigh-in again tomorrow morning. Once you have 2+ entries, your smoothed 7-day Exponential Moving Average (EMA) curve will render here automatically.
          </p>
        </div>
      </div>
    );
  }

  // 2+ Points State: Render Full SVG Curve
  const width = 600;
  const height = 220;
  const paddingX = 40;
  const paddingY = 30;

  const allValues = data.flatMap((d) => [d.rawWeightLbs, d.trendWeightLbs]);
  const minVal = Math.floor(Math.min(...allValues) - 0.5);
  const maxVal = Math.ceil(Math.max(...allValues) + 0.5);
  const valRange = Math.max(1, maxVal - minVal);

  const getX = (index: number) => {
    return paddingX + (index / (data.length - 1)) * (width - 2 * paddingX);
  };

  const getY = (val: number) => {
    return height - paddingY - ((val - minVal) / valRange) * (height - 2 * paddingY);
  };

  const trendPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.trendWeightLbs) }));
  let pathD = `M ${trendPoints[0].x} ${trendPoints[0].y}`;
  for (let i = 0; i < trendPoints.length - 1; i++) {
    const p0 = trendPoints[i];
    const p1 = trendPoints[i + 1];
    const cx = (p0.x + p1.x) / 2;
    pathD += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  return (
    <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono uppercase tracking-wider text-gray-400">
              Smart Scale Smoothing
            </span>
            <span className="px-2 py-0.5 rounded-full bg-brand-cyan/15 text-brand-cyan text-[10px] font-mono">
              7-Day EMA
            </span>
          </div>
          <div className="flex items-baseline space-x-3 mt-1">
            <h3 className="text-2xl font-black text-white font-mono">
              {latest.trendWeightLbs.toFixed(1)} lbs
            </h3>
            <span className="text-xs text-brand-emerald font-semibold flex items-center">
              <TrendingUp className="w-3.5 h-3.5 mr-1" />
              {deltaWeight >= 0 ? `+${deltaWeight.toFixed(1)}` : deltaWeight.toFixed(1)} lbs trend
            </span>
          </div>
        </div>

        <button
          onClick={onOpenWeighIn}
          className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-brand-cyan text-black font-bold text-xs hover:bg-brand-cyan/90 transition-all shadow-md shadow-brand-cyan/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Weigh-In</span>
        </button>
      </div>

      {/* SVG Responsive Line & Scatter Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          {/* Subtle Horizontal grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const val = minVal + ratio * valRange;
            const y = getY(val);
            return (
              <g key={ratio}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#1A1D27"
                  strokeDasharray="4 4"
                />
                <text
                  x={paddingX - 8}
                  y={y + 4}
                  fill="#6B7280"
                  fontSize="10"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Area under the trendline */}
          <path
            d={`${pathD} L ${trendPoints[trendPoints.length - 1].x} ${height - paddingY} L ${
              trendPoints[0].x
            } ${height - paddingY} Z`}
            fill="url(#trendGradient)"
            opacity="0.25"
          />

          {/* Trendline Gradient definition */}
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* 7-Day EMA Trendline */}
          <path
            d={pathD}
            fill="none"
            stroke="#00F0FF"
            strokeWidth="3.5"
            strokeLinecap="round"
          />

          {/* Raw Weigh-in Scatter points */}
          {data.map((d, i) => {
            const cx = getX(i);
            const cy = getY(d.rawWeightLbs);
            return (
              <g key={d.date}>
                <circle
                  cx={cx}
                  cy={cy}
                  r="4.5"
                  fill="#12141C"
                  stroke="#94A3B8"
                  strokeWidth="2"
                  className="hover:scale-125 transition-transform"
                />
              </g>
            );
          })}

          {/* Current Day Pulse Marker */}
          <circle
            cx={trendPoints[trendPoints.length - 1].x}
            cy={trendPoints[trendPoints.length - 1].y}
            r="6"
            fill="#00F0FF"
            stroke="#FFFFFF"
            strokeWidth="2"
          />

          {/* X Axis Labels */}
          {data.map((d, i) => {
            if (i % 2 !== 0 && i !== data.length - 1) return null;
            const x = getX(i);
            const dateStr = d.date.slice(5); // MM-DD
            return (
              <text
                key={`label-${d.date}`}
                x={x}
                y={height - 10}
                fill="#6B7280"
                fontSize="10"
                fontFamily="monospace"
                textAnchor="middle"
              >
                {dateStr}
              </text>
            );
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 mt-2 pt-3 border-t border-surface-border/50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 bg-brand-cyan rounded-full" />
            <span className="text-gray-300 font-medium">Smoothed EMA</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-gray-400 bg-surface" />
            <span className="text-gray-400">Raw Weigh-In</span>
          </div>
        </div>
        <span className="text-[11px] text-gray-500 italic mt-1 sm:mt-0">
          Filters daily sodium & glycogen water weight swings.
        </span>
      </div>
    </div>
  );
}
