"use client";

import React from "react";
import { LucideIcon, ChevronRight } from "lucide-react";

export interface SummaryCardProps {
  title: string;
  category?: string;
  icon?: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  value: string | number;
  unit?: string;
  subLabel?: string;
  badgeText?: string;
  badgeColor?: string;
  actionText?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function SummaryCard({
  title,
  category,
  icon: Icon,
  iconColor = "#0A84FF",
  iconBg = "rgba(10, 132, 255, 0.15)",
  value,
  unit,
  subLabel,
  badgeText,
  badgeColor = "rgba(10, 132, 255, 0.2)",
  actionText,
  onAction,
  children,
}: SummaryCardProps) {
  return (
    <div className="rounded-[22px] bg-[#1C1C1E] border border-[#2C2C2E]/60 p-5 shadow-xl space-y-4">
      {/* Category / Title Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          {Icon && (
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: iconBg, color: iconColor }}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
            </div>
          )}
          <div>
            {category && (
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8E8E93] block">
                {category}
              </span>
            )}
            <h3 className="text-sm font-bold text-white tracking-tight leading-tight">
              {title}
            </h3>
          </div>
        </div>

        {badgeText && (
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold"
            style={{ backgroundColor: badgeColor, color: iconColor }}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Main Metric Value and Sub-label (Collision-proof Flex) */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="flex items-baseline space-x-1.5">
          <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-semibold text-[#8E8E93] uppercase font-mono">
              {unit}
            </span>
          )}
        </div>

        {subLabel && (
          <span className="text-xs text-[#8E8E93] font-medium sm:text-right">
            {subLabel}
          </span>
        )}
      </div>

      {/* Custom Child Elements (e.g. mini chart, progress bar, presets) */}
      {children}

      {/* Optional Card Bottom Action */}
      {actionText && onAction && (
        <div className="pt-2 border-t border-[#2C2C2E]">
          <button
            type="button"
            onClick={onAction}
            className="w-full py-2 px-3 rounded-xl bg-[#2C2C2E] hover:bg-[#38383A] text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-all active:scale-95"
          >
            <span>{actionText}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#8E8E93]" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SummaryCard;
