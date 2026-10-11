"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db, LocalWeighIn, LocalMealLog, LocalScheduledWorkout } from "@/lib/db";
import { calculateWeightTrend, SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { getOrCreateScheduledWorkoutForDate } from "@/algorithms/workoutScheduler";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import {
  Flame,
  Dumbbell,
  Scale,
  UtensilsCrossed,
  ChevronRight,
  Plus,
  Play,
  ArrowUpRight,
  Coffee,
  CheckCircle2,
  Calendar,
} from "lucide-react";

export default function SummaryPage() {
  const { user, profile } = useAuth();
  const [trendData, setTrendData] = useState<SmoothedWeightPoint[]>([]);
  const [todayMeals, setTodayMeals] = useState<LocalMealLog[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<LocalScheduledWorkout | null>(null);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const todayStr = new Date().toISOString().split("T")[0]; // "2026-10-11"

  const loadSummaryData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Weigh-Ins & Calculate Trend
      const weighIns = await db.weighIns.where("userId").equals(user.id).toArray();
      if (weighIns.length > 0) {
        const smoothed = calculateWeightTrend(
          weighIns.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
        );
        setTrendData(smoothed);
      } else if (profile?.currentWeightLbs) {
        const baselineWeighIn: LocalWeighIn = {
          id: `weigh-${user.id}-${todayStr}`,
          userId: user.id,
          date: todayStr,
          rawWeightLbs: profile.currentWeightLbs,
          rawWeightKg: Number((profile.currentWeightLbs * 0.453592).toFixed(1)),
          trendWeightLbs: profile.currentWeightLbs,
          rateOfGainLbsPerWeek: 0,
          notes: "Starting Baseline Weigh-In",
          synced: false,
          createdAt: new Date().toISOString(),
        };
        await db.weighIns.put(baselineWeighIn);
        setTrendData(
          calculateWeightTrend([{ date: todayStr, rawWeightLbs: profile.currentWeightLbs }])
        );
      }

      // 2. Fetch Today's Meals
      const meals = await db.mealLogs
        .where("userId")
        .equals(user.id)
        .and((m) => m.date === todayStr)
        .toArray();
      setTodayMeals(meals);

      // 3. Fetch Today's Scheduled Workout
      const workout = await getOrCreateScheduledWorkoutForDate(
        user.id,
        todayStr,
        (profile?.trainingSplit || "ppl") as any,
        "08:00",
        profile?.workoutDaysPerWeek,
        profile?.customWeeklySchedule as any
      );
      setTodayWorkout(workout);
    } catch (err) {
      console.error("Failed to load Apple Health summary data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSummaryData();
  }, [user, profile]);

  // Macro Totals
  const consumedCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const consumedCarbs = todayMeals.reduce((acc, m) => acc + m.carbG, 0);
  const consumedFat = todayMeals.reduce((acc, m) => acc + m.fatG, 0);

  const targetCalories = profile?.targetCalories || 2600;
  const targetProtein = profile?.targetProteinG || 160;

  // Calorie & Protein Progress Percentages
  const caloriePercent = Math.min(100, Math.round((consumedCalories / targetCalories) * 100));
  const proteinPercent = Math.min(100, Math.round((consumedProtein / targetProtein) * 100));
  const calorieRemainder = targetCalories - consumedCalories;

  const latestTrendPoint = trendData[trendData.length - 1] || {
    rateOfGainLbsPerWeek: 0,
    gainZone: "stagnant",
    trendWeightLbs: profile?.currentWeightLbs || 0,
  };

  const formattedEyebrowDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "A";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* =========================================================================
          APPLE HEALTH LARGE TITLE HEADER
          Eyebrow Date, Massive Title: "Summary", Profile Avatar Pinned Top-Right
          ========================================================================= */}
      <header className="flex items-end justify-between pt-2 pb-1">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] block">
            {formattedEyebrowDate}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-0.5">
            Summary
          </h1>
        </div>

        {/* Circular Profile Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center font-bold text-xs text-white shadow-md">
          {userInitial}
        </div>
      </header>

      {/* =========================================================================
          FAVORITES SECTION HEADER (Apple Health HIG)
          ========================================================================= */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-lg font-bold text-white tracking-tight">Favorites</h2>
        <button
          onClick={() => setIsWeighInOpen(true)}
          className="text-xs font-semibold text-[#0A84FF] hover:underline"
        >
          + Log Metric
        </button>
      </div>

      {/* =========================================================================
          FAVORITES HEALTH METRIC CARDS (Apple Health Category Accents)
          ========================================================================= */}
      <div className="space-y-3.5">
        {/* CARD 1: ACTIVE ENERGY / CALORIC SURPLUS (#FF9500 Flame Orange) */}
        <Link
          href="/food"
          className="block p-4 rounded-[20px] bg-[#1C1C1E] border border-[#2C2C2E]/60 hover:border-[#38383A] transition-all active:scale-[0.99] shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#FF9500]/20 text-[#FF9500] flex items-center justify-center">
                <Flame className="w-4 h-4 fill-current" />
              </div>
              <span className="text-xs font-semibold text-[#FF9500] tracking-wide">
                Active Energy / Surplus
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[#8E8E93] text-xs font-mono">
              <span>TODAY</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-3xl font-extrabold text-white tracking-tight font-sans">
                {consumedCalories.toLocaleString()}
              </span>
              <span className="text-sm font-semibold text-[#8E8E93] ml-1.5">
                / {targetCalories.toLocaleString()} kcal
              </span>
            </div>
            <span className="text-xs font-semibold text-[#8E8E93] font-mono">
              {caloriePercent}%
            </span>
          </div>

          {/* Apple Health Activity Bar Gauge */}
          <div className="w-full h-2 rounded-full bg-[#2C2C2E] overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF9500] to-[#FFD60A] transition-all duration-500"
              style={{ width: `${caloriePercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#8E8E93] mt-2.5">
            <span>
              {calorieRemainder > 0
                ? `${calorieRemainder.toLocaleString()} kcal remaining for surplus`
                : `+${Math.abs(calorieRemainder).toLocaleString()} kcal surplus exceeded`}
            </span>
            <span className="text-[11px] font-mono text-gray-400">
              Carbs: {consumedCarbs}g • Fat: {consumedFat}g
            </span>
          </div>
        </Link>

        {/* CARD 2: PROTEIN INTAKE (#FF2D55 Hot Pink / Activity Red) */}
        <Link
          href="/food"
          className="block p-4 rounded-[20px] bg-[#1C1C1E] border border-[#2C2C2E]/60 hover:border-[#38383A] transition-all active:scale-[0.99] shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#FF2D55]/20 text-[#FF2D55] flex items-center justify-center">
                <UtensilsCrossed className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#FF2D55] tracking-wide">
                Protein Intake
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[#8E8E93] text-xs font-mono">
              <span>TODAY</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-3xl font-extrabold text-white tracking-tight font-sans">
                {consumedProtein}
              </span>
              <span className="text-sm font-semibold text-[#8E8E93] ml-1.5">
                / {targetProtein} g
              </span>
            </div>
            <span className="text-xs font-semibold text-[#8E8E93] font-mono">
              {proteinPercent}%
            </span>
          </div>

          {/* Apple Health Activity Bar Gauge */}
          <div className="w-full h-2 rounded-full bg-[#2C2C2E] overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#FF2D55] to-[#FF6482] transition-all duration-500"
              style={{ width: `${proteinPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#8E8E93] mt-2.5">
            <span>
              {targetProtein - consumedProtein > 0
                ? `${targetProtein - consumedProtein}g to reach daily synthesis goal`
                : "Target met! Optimal muscle recovery."}
            </span>
            <span className="text-[11px] font-mono text-[#FF2D55]">
              {(profile?.proteinRatioPerLb || 0.9).toFixed(2)} g/lb
            </span>
          </div>
        </Link>

        {/* CARD 3: WEIGHT TREND (#AF52DE Purple / Violet) */}
        <Link
          href="/vault"
          className="block p-4 rounded-[20px] bg-[#1C1C1E] border border-[#2C2C2E]/60 hover:border-[#38383A] transition-all active:scale-[0.99] shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#AF52DE]/20 text-[#AF52DE] flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#AF52DE] tracking-wide">
                Body Weight Trend
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[#8E8E93] text-xs font-mono">
              <span>7-DAY AVG</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mt-2">
            <div>
              <span className="text-3xl font-extrabold text-white tracking-tight font-sans">
                {latestTrendPoint.trendWeightLbs.toFixed(1)}
              </span>
              <span className="text-sm font-semibold text-[#8E8E93] ml-1.5">lbs</span>
            </div>

            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-[#AF52DE]/20 text-[#AF52DE] font-mono">
              {latestTrendPoint.rateOfGainLbsPerWeek > 0
                ? `+${latestTrendPoint.rateOfGainLbsPerWeek.toFixed(2)}`
                : latestTrendPoint.rateOfGainLbsPerWeek.toFixed(2)}{" "}
              lbs/wk
            </span>
          </div>

          {/* Mini Apple Health Sparkline Visualization */}
          <div className="h-10 flex items-end space-x-2 pt-2 mt-2">
            {trendData.slice(-7).map((pt, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-md bg-[#AF52DE]/40 hover:bg-[#AF52DE] transition-colors"
                  style={{
                    height: `${Math.max(12, Math.min(36, ((pt.trendWeightLbs % 10) + 1) * 3))}px`,
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-[#8E8E93] mt-2 border-t border-[#2C2C2E] pt-2">
            <span>
              Target Gain: +{profile?.targetGainRateLbsPerWeek || 0.5} lbs/week
            </span>
            <span className="text-[#AF52DE] font-semibold text-[11px]">
              {latestTrendPoint.gainZone === "sweet_spot" || latestTrendPoint.gainZone === "mild_gain"
                ? "Optimal Lean Bulk Zone"
                : "Maintenance / Tracking"}
            </span>
          </div>
        </Link>

        {/* CARD 4: WORKOUT TODAY SNAPSHOT (#0A84FF Electric Blue) */}
        <Link
          href="/lift"
          className="block p-4 rounded-[20px] bg-[#1C1C1E] border border-[#2C2C2E]/60 hover:border-[#38383A] transition-all active:scale-[0.99] shadow-lg"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <div className="w-7 h-7 rounded-lg bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center">
                {todayWorkout?.dayType === "rest" ? (
                  <Coffee className="w-4 h-4 text-amber-400" />
                ) : (
                  <Dumbbell className="w-4 h-4" />
                )}
              </div>
              <span className="text-xs font-semibold text-[#0A84FF] tracking-wide">
                Today&apos;s Workout
              </span>
            </div>
            <div className="flex items-center space-x-1 text-[#8E8E93] text-xs font-mono">
              <span>{todayWorkout?.scheduledTime || "08:00 AM"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xl font-bold text-white tracking-tight">
              {todayWorkout?.routineName || "Push Day A"}
            </div>
            <p className="text-xs text-[#8E8E93] mt-0.5 line-clamp-1">
              {todayWorkout?.notes || "Progressive overload hyper-focus session."}
            </p>
          </div>

          {/* Muscle Focus Chips & Action */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#2C2C2E]">
            <div className="flex items-center space-x-1.5 flex-wrap">
              {todayWorkout?.focusMuscleGroups?.slice(0, 3).map((m) => (
                <span
                  key={m}
                  className="px-2 py-0.5 rounded-md bg-[#2C2C2E] text-[10px] font-mono uppercase text-[#8E8E93]"
                >
                  {m}
                </span>
              ))}
            </div>

            {todayWorkout?.isCompleted ? (
              <span className="text-xs font-bold text-[#30D158] flex items-center space-x-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Completed</span>
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-[#0A84FF] text-white text-xs font-bold flex items-center space-x-1 shadow-md shadow-[#0A84FF]/20">
                <Play className="w-3 h-3 fill-current" />
                <span>Start</span>
              </span>
            )}
          </div>
        </Link>
      </div>

      {/* Quick Weigh-In Action Sheet */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={latestTrendPoint.trendWeightLbs}
        onWeightLogged={loadSummaryData}
      />
    </div>
  );
}
