"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { db, LocalProfile, LocalWeighIn, LocalMealLog } from "@/lib/db";
import { calculateWeightTrend, SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { RateOfGainGauge } from "@/components/dashboard/RateOfGainGauge";
import { DualProgressRings } from "@/components/dashboard/DualProgressRings";
import { WeightTrendChart } from "@/components/dashboard/WeightTrendChart";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import { Dumbbell, Camera, ChevronRight, Sparkles, Scale } from "lucide-react";

export default function DashboardPage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [trendData, setTrendData] = useState<SmoothedWeightPoint[]>([]);
  const [todayMeals, setTodayMeals] = useState<LocalMealLog[]>([]);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDashboardData = async () => {
    try {
      // 1. Fetch Profile
      const userProfile = await db.profiles.toCollection().first();
      if (userProfile) setProfile(userProfile);

      // 2. Fetch Weigh-Ins & Calculate Trend
      const weighIns = await db.weighIns.toArray();
      if (weighIns.length > 0) {
        const smoothed = calculateWeightTrend(
          weighIns.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
        );
        setTrendData(smoothed);
      }

      // 3. Fetch Today's Meals
      const today = new Date().toISOString().split("T")[0];
      const meals = await db.mealLogs.where("date").equals(today).toArray();
      setTodayMeals(meals);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Compute macro totals
  const consumedCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const consumedCarbs = todayMeals.reduce((acc, m) => acc + m.carbG, 0);
  const consumedFat = todayMeals.reduce((acc, m) => acc + m.fatG, 0);

  const latestTrendPoint = trendData[trendData.length - 1] || {
    rateOfGainLbsPerWeek: 0.34,
    gainZone: "sweet_spot",
    trendWeightLbs: profile?.currentWeightLbs || 175.5,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* =========================================================================
          TOP BANNER: BULK STREAK & QUICK WEIGH-IN TRIGGER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-surface border border-surface-border">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-brand-cyan/15 text-brand-cyan flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-brand-cyan uppercase tracking-wider">
                Phase: Lean Bulk
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400 font-mono">Week 6</span>
            </div>
            <h2 className="text-base font-bold text-white">42-Day Consistent Accretion Streak</h2>
          </div>
        </div>

        <button
          onClick={() => setIsWeighInOpen(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-2xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/40 text-sm font-semibold text-white transition-all active:scale-95"
        >
          <Scale className="w-4 h-4 text-brand-cyan" />
          <span>Quick Weigh-In</span>
        </button>
      </div>

      {/* =========================================================================
          ANALYTICAL ROW 1: SPEEDOMETER & FUELING RINGS (Dual Pane on Desktop)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RateOfGainGauge
          rateOfGainLbsPerWeek={latestTrendPoint.rateOfGainLbsPerWeek}
          gainZone={latestTrendPoint.gainZone}
          targetGainRateLbsPerWeek={profile?.targetGainRateLbsPerWeek || 0.35}
        />

        <DualProgressRings
          consumedCalories={consumedCalories}
          targetCalories={profile?.targetCalories || 2925}
          consumedProtein={consumedProtein}
          targetProtein={profile?.targetProteinG || 167}
          consumedCarbs={consumedCarbs}
          targetCarbs={profile?.targetCarbG || 390}
          consumedFat={consumedFat}
          targetFat={profile?.targetFatG || 81}
        />
      </div>

      {/* =========================================================================
          ANALYTICAL ROW 2: 7-DAY WEIGHT TRENDLINE
          ========================================================================= */}
      <WeightTrendChart
        data={trendData}
        onOpenWeighIn={() => setIsWeighInOpen(true)}
      />

      {/* =========================================================================
          QUICK ACTION LAUNCH CARDS (Lift Logger & Photo Vault)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Workout Launch Card */}
        <Link
          href="/lift"
          className="group block p-6 rounded-3xl bg-surface border border-surface-border hover:border-brand-cyan/40 transition-all shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-brand-cyan/15 text-brand-cyan group-hover:scale-110 transition-transform">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-brand-cyan">
                  Today's Overload Session
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-brand-cyan transition-colors">
                  Push Day A (Chest & Triceps)
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Target: Beat 185 lbs × 8 reps on Incline Press
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-cyan group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* Photo Vault Launch Card */}
        <Link
          href="/vault"
          className="group block p-6 rounded-3xl bg-surface border border-surface-border hover:border-brand-emerald/40 transition-all shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-brand-emerald/15 text-brand-emerald group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-brand-emerald">
                  Physique Vault
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-brand-emerald transition-colors">
                  Standardized Progress Photos
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ghost silhouette alignment ready for Week 6 check-in
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-emerald group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Quick Weigh-In Modal */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={trendData[trendData.length - 1]?.rawWeightLbs || 175.5}
        onWeightLogged={loadDashboardData}
      />
    </div>
  );
}
