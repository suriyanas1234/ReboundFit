"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { db, LocalWeighIn, LocalMealLog, LocalProgressPhoto } from "@/lib/db";
import { calculateWeightTrend, SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { RateOfGainGauge } from "@/components/dashboard/RateOfGainGauge";
import { DualProgressRings } from "@/components/dashboard/DualProgressRings";
import { WeightTrendChart } from "@/components/dashboard/WeightTrendChart";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import { Dumbbell, Camera, ChevronRight, Sparkles, Scale, Plus, Calendar } from "lucide-react";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  const [trendData, setTrendData] = useState<SmoothedWeightPoint[]>([]);
  const [todayMeals, setTodayMeals] = useState<LocalMealLog[]>([]);
  const [baselinePhoto, setBaselinePhoto] = useState<LocalProgressPhoto | null>(null);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Weigh-Ins for current user & Calculate Trend
      const weighIns = await db.weighIns.where("userId").equals(user.id).toArray();
      if (weighIns.length > 0) {
        const smoothed = calculateWeightTrend(
          weighIns.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
        );
        setTrendData(smoothed);
      } else if (profile?.currentWeightLbs) {
        // If device has no local weigh-in yet, seed baseline from authenticated profile
        const today = new Date().toISOString().split("T")[0];
        const baselineWeighIn: LocalWeighIn = {
          id: `weigh-${user.id}-${today}`,
          userId: user.id,
          date: today,
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
          calculateWeightTrend([
            { date: today, rawWeightLbs: profile.currentWeightLbs },
          ])
        );
      } else {
        setTrendData([]);
      }

      // 2. Fetch Today's Meals for current user
      const today = new Date().toISOString().split("T")[0];
      const meals = await db.mealLogs
        .where("userId")
        .equals(user.id)
        .and((m) => m.date === today)
        .toArray();
      setTodayMeals(meals);

      // 3. Fetch Baseline Photo
      const photo = await db.photos
        .where("userId")
        .equals(user.id)
        .and((p) => p.isBaseline === true)
        .first();
      if (photo) setBaselinePhoto(photo);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user, profile]);

  // Compute macro totals for today
  const consumedCalories = todayMeals.reduce((acc, m) => acc + m.calories, 0);
  const consumedProtein = todayMeals.reduce((acc, m) => acc + m.proteinG, 0);
  const consumedCarbs = todayMeals.reduce((acc, m) => acc + m.carbG, 0);
  const consumedFat = todayMeals.reduce((acc, m) => acc + m.fatG, 0);

  // Dynamic week calculation from user's actual profile creation date
  const createdAtTime = profile?.createdAt ? new Date(profile.createdAt).getTime() : Date.now();
  const daysElapsed = Math.max(1, Math.ceil((Date.now() - createdAtTime) / (1000 * 60 * 60 * 24)));
  const currentWeekNumber = Math.ceil(daysElapsed / 7);

  const latestTrendPoint = trendData[trendData.length - 1] || {
    rateOfGainLbsPerWeek: 0,
    gainZone: "stagnant",
    trendWeightLbs: profile?.currentWeightLbs || 0,
  };

  const getSplitDisplayName = (split?: string) => {
    switch (split) {
      case "ppl":
        return "Push Day A (Chest & Triceps Hypertrophy)";
      case "upper_lower":
        return "Upper Body A (Chest, Back & Delts)";
      case "full_body":
        return "Full Body Routine A (Squat, Bench, Rows)";
      default:
        return "Custom Overload Session";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* =========================================================================
          TOP BANNER: DYNAMIC BULK PHASE & WEIGH-IN TRIGGER
          ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-surface border border-surface-border">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-2xl bg-brand-cyan/15 text-brand-cyan flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold text-brand-cyan uppercase tracking-wider">
                Phase: {profile?.primaryGoal === "recomp" ? "Body Recomposition" : "Lean Bulk"}
              </span>
              <span className="text-xs text-gray-500">•</span>
              <span className="text-xs text-gray-400 font-mono">Week {currentWeekNumber}</span>
            </div>
            <h2 className="text-base font-bold text-white">
              Day {daysElapsed} Active • Target: {profile?.targetGainRateLbsPerWeek ? `+${profile.targetGainRateLbsPerWeek} lbs/wk` : "Maintain"}
            </h2>
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
          ANALYTICAL ROW 1: SPEEDOMETER & FUELING RINGS
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RateOfGainGauge
          rateOfGainLbsPerWeek={latestTrendPoint.rateOfGainLbsPerWeek}
          gainZone={latestTrendPoint.gainZone}
          targetGainRateLbsPerWeek={profile?.targetGainRateLbsPerWeek || 0.50}
          dataPointsCount={trendData.length}
        />

        <DualProgressRings
          consumedCalories={consumedCalories}
          targetCalories={profile?.targetCalories || 2600}
          consumedProtein={consumedProtein}
          targetProtein={profile?.targetProteinG || 160}
          consumedCarbs={consumedCarbs}
          targetCarbs={profile?.targetCarbG || 320}
          consumedFat={consumedFat}
          targetFat={profile?.targetFatG || 70}
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
          QUICK ACTION LAUNCH CARDS (Schedule, Routine & Photo Vault)
          ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Workout Schedule Launch Card */}
        <Link
          href="/lift?view=schedule"
          className="group block p-6 rounded-3xl bg-surface border border-surface-border hover:border-brand-cyan/40 transition-all shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-brand-cyan/15 text-brand-cyan group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-brand-cyan">
                  Workout Schedule
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-brand-cyan transition-colors">
                  Date-by-Date Plan
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  View scheduled lifts by date & sync with Google Calendar
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-cyan group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* Workout Session Launch Card */}
        <Link
          href="/lift?view=session"
          className="group block p-6 rounded-3xl bg-surface border border-surface-border hover:border-brand-emerald/40 transition-all shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-brand-emerald/15 text-brand-emerald group-hover:scale-110 transition-transform">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-brand-emerald">
                  Active Overload
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-brand-emerald transition-colors">
                  {getSplitDisplayName(profile?.trainingSplit)}
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  Tap to log progressive overload sets with inline session targets
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-emerald group-hover:translate-x-1 transition-all" />
          </div>
        </Link>

        {/* Photo Vault Launch Card */}
        <Link
          href="/vault"
          className="group block p-6 rounded-3xl bg-surface border border-surface-border hover:border-brand-cyan/40 transition-all shadow-xl relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-brand-cyan/15 text-brand-cyan group-hover:scale-110 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-brand-cyan">
                  Physique Vault
                </span>
                <h4 className="text-base font-bold text-white group-hover:text-brand-cyan transition-colors">
                  Standardized Photos
                </h4>
                <p className="text-xs text-gray-400 mt-0.5">
                  {baselinePhoto
                    ? "Baseline reference photo active for ghost overlay"
                    : "No photos yet — snap your Day 1 standardized reference"}
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-brand-cyan group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
      </div>

      {/* Quick Weigh-In Modal */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={trendData[trendData.length - 1]?.rawWeightLbs || profile?.currentWeightLbs || 175}
        onWeightLogged={loadDashboardData}
      />
    </div>
  );
}
