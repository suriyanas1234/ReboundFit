"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
import { db, LocalWeighIn, LocalMealLog, LocalScheduledWorkout, LocalHealthMetric } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { calculateWeightTrend, SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { getOrCreateScheduledWorkoutForDate } from "@/algorithms/workoutScheduler";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { NutritionCard } from "@/components/dashboard/NutritionCard";
import { WeightTrendCard } from "@/components/dashboard/WeightTrendCard";
import { WorkoutCard } from "@/components/dashboard/WorkoutCard";
import { WeightTrendChart } from "@/components/dashboard/WeightTrendChart";
import { DualProgressRings } from "@/components/dashboard/DualProgressRings";
import { StepCountCard } from "@/components/dashboard/StepCountCard";
import { SleepAnalysisCard } from "@/components/dashboard/SleepAnalysisCard";
import { TotalBurnCard } from "@/components/dashboard/TotalBurnCard";
import { HeartRateCard } from "@/components/dashboard/HeartRateCard";
import {
  Flame,
  Dumbbell,
  Scale,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingUp,
  LayoutDashboard,
  Activity,
} from "lucide-react";

export default function SummaryPage() {
  const { user, profile } = useAuth();
  const { isSyncing, syncNow } = useCloudSync();

  const [trendData, setTrendData] = useState<SmoothedWeightPoint[]>([]);
  const [todayMeals, setTodayMeals] = useState<LocalMealLog[]>([]);
  const [todayWorkout, setTodayWorkout] = useState<LocalScheduledWorkout | null>(null);
  const [todayHealthMetric, setTodayHealthMetric] = useState<LocalHealthMetric | null>(null);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const todayStr = new Date().toISOString().split("T")[0]; // "2026-10-11"

  const loadSummaryData = useCallback(async () => {
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

      // 4. Fetch Apple Health Metrics (Local first, then remote check)
      const localMetrics = await db.healthMetrics
        .where("userId")
        .equals(user.id)
        .toArray();

      const matchedToday = localMetrics.find((m) => m.date === todayStr);
      if (matchedToday) {
        setTodayHealthMetric(matchedToday);
      } else if (localMetrics.length > 0) {
        const sorted = [...localMetrics].sort((a, b) => b.date.localeCompare(a.date));
        setTodayHealthMetric(sorted[0]);
      }

      // Check Supabase for recent webhook-synced metrics
      try {
        const { data: remoteMetric } = await supabase
          .from("health_metrics")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (remoteMetric) {
          const localItem: LocalHealthMetric = {
            id: remoteMetric.id || `hm-${user.id}-${remoteMetric.date}`,
            userId: user.id,
            date: remoteMetric.date,
            weightLbs: remoteMetric.weight_lbs ? Number(remoteMetric.weight_lbs) : undefined,
            weightKg: remoteMetric.weight_kg ? Number(remoteMetric.weight_kg) : undefined,
            activeEnergyBurnedKcal: remoteMetric.active_energy_burned_kcal ? Number(remoteMetric.active_energy_burned_kcal) : undefined,
            basalEnergyBurnedKcal: remoteMetric.basal_energy_burned_kcal ? Number(remoteMetric.basal_energy_burned_kcal) : undefined,
            totalEnergyBurnedKcal: remoteMetric.total_energy_burned_kcal ? Number(remoteMetric.total_energy_burned_kcal) : undefined,
            stepCount: remoteMetric.step_count ? Number(remoteMetric.step_count) : undefined,
            distanceKm: remoteMetric.distance_km ? Number(remoteMetric.distance_km) : undefined,
            sleepHours: remoteMetric.sleep_hours ? Number(remoteMetric.sleep_hours) : undefined,
            deepSleepHours: remoteMetric.deep_sleep_hours ? Number(remoteMetric.deep_sleep_hours) : undefined,
            restingHeartRateBpm: remoteMetric.resting_heart_rate_bpm ? Number(remoteMetric.resting_heart_rate_bpm) : undefined,
            source: remoteMetric.source || "apple_health",
            rawPayload: remoteMetric.raw_payload,
            synced: true,
            createdAt: remoteMetric.created_at || new Date().toISOString(),
            updatedAt: remoteMetric.updated_at || new Date().toISOString(),
          };
          await db.healthMetrics.put(localItem);
          setTodayHealthMetric(localItem);
        }
      } catch {
        // Continue with local data if offline
      }
    } catch (err) {
      console.error("Failed to load Apple Health summary data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user, profile, todayStr]);

  // Initial load & real-time sync listener
  useEffect(() => {
    loadSummaryData();

    // Listen for cross-device cloud sync events
    const handleSyncEvent = () => {
      loadSummaryData();
    };

    window.addEventListener("reboundfit_sync", handleSyncEvent);
    return () => {
      window.removeEventListener("reboundfit_sync", handleSyncEvent);
    };
  }, [loadSummaryData]);

  // Macro Totals
  const consumedCalories = todayMeals.reduce((acc, m) => acc + (Number(m.calories) || 0), 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + (Number(m.proteinG) || 0), 0);
  const consumedCarbs = todayMeals.reduce((acc, m) => acc + (Number(m.carbG) || 0), 0);
  const consumedFat = todayMeals.reduce((acc, m) => acc + (Number(m.fatG) || 0), 0);

  const targetCalories = Number(profile?.targetCalories || 2600);
  const targetProtein = Number(profile?.targetProteinG || 160);
  const targetCarbs = Number(profile?.targetCarbG || 315);
  const targetFat = Number(profile?.targetFatG || 74);

  const latestTrendPoint = trendData.length > 0 ? trendData[trendData.length - 1] : {
    rateOfGainLbsPerWeek: 0,
    gainZone: "stagnant" as const,
    trendWeightLbs: Number(profile?.currentWeightLbs || 175),
    date: todayStr,
    rawWeightLbs: Number(profile?.currentWeightLbs || 175),
  };

  const formattedEyebrowDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "A";

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in pb-8">
      {/* =========================================================================
          APPLE HEALTH LARGE TITLE HEADER
          Eyebrow Date, Massive Title: "Summary", Profile Avatar Pinned Top-Right
          ========================================================================= */}
      <header className="flex items-end justify-between pt-1 pb-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] block">
            {formattedEyebrowDate}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mt-1">
            Summary
          </h1>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#1C1C1E] border border-[#38383A] text-xs font-semibold text-[#8E8E93] hover:text-white transition-all"
            title="Sync Cloud Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#0A84FF]" : ""}`} />
            <span>{isSyncing ? "Syncing..." : "Sync"}</span>
          </button>

          {/* Circular Profile Avatar (Triggers Settings Modal) */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center font-bold text-sm text-white shadow-md hover:ring-2 hover:ring-[#0A84FF] active:scale-95 transition-all cursor-pointer"
            title="Health Profile & Settings"
            aria-label="Open Health Profile and Settings"
          >
            {userInitial}
          </button>
        </div>
      </header>

      {/* =========================================================================
          FAVORITES SECTION (Responsive: Mobile Single-Column vs Desktop 3-Column Grid)
          ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">Favorites</h2>
            <span className="px-2 py-0.5 rounded-full bg-[#2C2C2E] text-[10px] font-mono text-[#8E8E93]">
              LIVE
            </span>
          </div>

          <button
            onClick={() => setIsWeighInOpen(true)}
            className="text-xs font-semibold text-[#0A84FF] hover:underline flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Log Metric</span>
          </button>
        </div>

        {/* Responsive Grid: Mobile 1 column, Desktop 2 or 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {/* Card 1: Nutrition & Macro Intake */}
          <NutritionCard
            consumedCalories={consumedCalories}
            targetCalories={targetCalories}
            consumedProtein={consumedProtein}
            targetProtein={targetProtein}
            consumedCarbs={consumedCarbs}
            consumedFat={consumedFat}
            targetCarbs={targetCarbs}
            targetFat={targetFat}
          />

          {/* Card 2: Weight Trend & Sparkline */}
          <WeightTrendCard
            trendWeightLbs={latestTrendPoint.trendWeightLbs}
            rateOfGainLbsPerWeek={latestTrendPoint.rateOfGainLbsPerWeek}
            targetGainRateLbsPerWeek={profile?.targetGainRateLbsPerWeek || 0.35}
            trendData={trendData}
            gainZone={latestTrendPoint.gainZone}
            onOpenWeighIn={() => setIsWeighInOpen(true)}
          />

          {/* Card 3: Workout Today Snapshot */}
          <div className="md:col-span-2 lg:col-span-1">
            <WorkoutCard workout={todayWorkout} />
          </div>
        </div>
      </section>

      {/* =========================================================================
          APPLE HEALTH ACTIVITY & VITALS (HealthKit Synchronized Feed)
          Daily Steps, Sleep Analysis, Total Energy Burn, and Resting Heart Rate
          ========================================================================= */}
      <section className="space-y-4 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Activity & Vitals
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#30D158]/15 text-[10px] font-mono text-[#30D158] font-bold">
              APPLE HEALTH
            </span>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-xs font-semibold text-[#0A84FF] hover:underline flex items-center space-x-1"
          >
            <span>Sync Setup</span>
          </button>
        </div>

        {/* 4-Card Responsive Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {/* 1. Daily Steps & Distance */}
          <StepCountCard
            steps={todayHealthMetric?.stepCount}
            distanceKm={todayHealthMetric?.distanceKm}
            targetSteps={10000}
            onOpenSyncGuide={() => setIsSettingsOpen(true)}
          />

          {/* 2. Sleep Analysis */}
          <SleepAnalysisCard
            sleepHours={todayHealthMetric?.sleepHours}
            deepSleepHours={todayHealthMetric?.deepSleepHours}
            onOpenSyncGuide={() => setIsSettingsOpen(true)}
          />

          {/* 3. Total Daily Burn (Active + Basal Energy) */}
          <TotalBurnCard
            totalBurnKcal={todayHealthMetric?.totalEnergyBurnedKcal}
            activeBurnKcal={todayHealthMetric?.activeEnergyBurnedKcal}
            basalBurnKcal={todayHealthMetric?.basalEnergyBurnedKcal || profile?.baseTdee}
            consumedCalories={consumedCalories}
            targetCalories={targetCalories}
            onOpenSyncGuide={() => setIsSettingsOpen(true)}
          />

          {/* 4. Resting Heart Rate */}
          <HeartRateCard
            restingHeartRateBpm={todayHealthMetric?.restingHeartRateBpm}
            onOpenSyncGuide={() => setIsSettingsOpen(true)}
          />
        </div>
      </section>

      {/* =========================================================================
          DESKTOP DUAL-PANE ANALYTICAL DASHBOARD (Tablets & Desktop Breakpoints)
          Left: Interactive Weight Trend Curve / Right: Apple Fitness Progress Rings
          ========================================================================= */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <LayoutDashboard className="w-4 h-4 text-[#0A84FF]" />
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              Analytical Deep-Dive
            </h2>
          </div>
          <span className="text-xs text-[#8E8E93] font-mono hidden sm:inline">
            7-Day Exponential Moving Average
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Pane: Interactive Weight Trend Chart (2 Columns on large screens) */}
          <div className="lg:col-span-2">
            <WeightTrendChart
              data={trendData}
              onOpenWeighIn={() => setIsWeighInOpen(true)}
            />
          </div>

          {/* Right Pane: Concentric Apple Health Macro & Energy Rings */}
          <div className="lg:col-span-1">
            <DualProgressRings
              consumedCalories={consumedCalories}
              targetCalories={targetCalories}
              consumedProtein={consumedProtein}
              targetProtein={targetProtein}
              consumedCarbs={consumedCarbs}
              targetCarbs={targetCarbs}
              consumedFat={consumedFat}
              targetFat={targetFat}
            />
          </div>
        </div>
      </section>

      {/* Quick Weigh-In Action Sheet */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={latestTrendPoint.trendWeightLbs}
        onWeightLogged={loadSummaryData}
      />

      {/* Dedicated Settings & Health Profile Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
