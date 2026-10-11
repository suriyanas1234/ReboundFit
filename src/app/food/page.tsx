"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
import { db, LocalMealLog } from "@/lib/db";
import {
  Flame,
  UtensilsCrossed,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  X,
  PieChart,
  Beef,
  Coffee,
  Sun,
  Moon,
  Zap,
} from "lucide-react";

const MEAL_CATEGORIES: { type: LocalMealLog["mealType"]; label: string; icon: any }[] = [
  { type: "breakfast", label: "Breakfast", icon: Coffee },
  { type: "lunch", label: "Lunch", icon: Sun },
  { type: "dinner", label: "Dinner", icon: Moon },
  { type: "post_workout", label: "Post-Workout", icon: Zap },
  { type: "snack", label: "Snacks", icon: UtensilsCrossed },
];

export default function NutritionPage() {
  const { user, profile } = useAuth();
  const { saveMealLog, deleteMealLog } = useCloudSync();
  const [meals, setMeals] = useState<LocalMealLog[]>([]);
  const [timeRange, setTimeRange] = useState<"day" | "week" | "month">("day");
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);

  // Form State
  const [mealName, setMealName] = useState<string>("");
  const [mealType, setMealType] = useState<LocalMealLog["mealType"]>("lunch");
  const [calories, setCalories] = useState<number>(650);
  const [proteinG, setProteinG] = useState<number>(45);
  const [carbG, setCarbG] = useState<number>(75);
  const [fatG, setFatG] = useState<number>(15);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadMeals = useCallback(async () => {
    if (!user) return;
    const todayMeals = await db.mealLogs
      .where("userId")
      .equals(user.id)
      .and((m) => m.date === todayStr)
      .toArray();
    setMeals(todayMeals);
  }, [user, todayStr]);

  useEffect(() => {
    loadMeals();

    const handleSync = () => {
      loadMeals();
    };

    window.addEventListener("reboundfit_sync", handleSync);
    return () => {
      window.removeEventListener("reboundfit_sync", handleSync);
    };
  }, [loadMeals]);

  // Aggregate Totals
  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.proteinG, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbG, 0);
  const totalFat = meals.reduce((sum, m) => sum + m.fatG, 0);

  const targetCalories = profile?.targetCalories || 2650;
  const targetProtein = profile?.targetProteinG || 160;
  const targetCarbs = profile?.targetCarbG || 330;
  const targetFat = profile?.targetFatG || 70;

  const calorieDelta = targetCalories - totalCalories;
  const caloriePercent = Math.min(100, Math.round((totalCalories / targetCalories) * 100));

  // Quick 1-Tap Preset Add with Cloud Realtime Sync
  const handleQuickAdd = async (
    name: string,
    cal: number,
    pro: number,
    carbs: number,
    fat: number,
    type: LocalMealLog["mealType"] = "snack"
  ) => {
    if (!user) return;
    await saveMealLog({
      name,
      mealType: type,
      calories: cal,
      proteinG: pro,
      carbG: carbs,
      fatG: fat,
      isQuickDial: true,
      date: todayStr,
    });
    await loadMeals();
  };

  const handleSaveMeal = async () => {
    if (!user) return;
    await saveMealLog({
      name: mealName.trim() || `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} Meal`,
      mealType,
      calories,
      proteinG,
      carbG,
      fatG,
      isQuickDial: false,
      date: todayStr,
    });
    await loadMeals();
    setIsLogModalOpen(false);
    setMealName("");
  };

  const handleDeleteMeal = async (id: string) => {
    await deleteMealLog(id);
    await loadMeals();
  };

  const formattedEyebrowDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* =========================================================================
          APPLE HEALTH LARGE TITLE HEADER
          ========================================================================= */}
      <header className="pt-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] block">
          {formattedEyebrowDate}
        </span>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Nutrition
          </h1>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="w-9 h-9 rounded-full bg-[#FF9500] text-black flex items-center justify-center font-bold shadow-lg shadow-[#FF9500]/20 active:scale-95 transition-all"
            title="Log Meal"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          APPLE NATIVE SEGMENTED CONTROL PILL
          ========================================================================= */}
      <div className="p-1 rounded-xl bg-[#1C1C1E] border border-[#2C2C2E] flex items-center">
        {(["day", "week", "month"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setTimeRange(tab)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
              timeRange === tab
                ? "bg-[#2C2C2E] text-white shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* =========================================================================
          TOP HERO STAT CARD (Apple Health Energy Hero)
          ========================================================================= */}
      <div className="p-6 rounded-[24px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF9500]/20 text-[#FF9500] flex items-center justify-center">
              <Flame className="w-4 h-4 fill-current" />
            </div>
            <span className="text-xs font-semibold text-[#FF9500] tracking-wide uppercase">
              Dietary Energy
            </span>
          </div>
          <span className="text-xs font-mono text-[#8E8E93]">TODAY</span>
        </div>

        {/* Central Bold Stat */}
        <div className="text-center py-2">
          <div className="text-5xl sm:text-6xl font-black text-white tracking-tight font-sans">
            {totalCalories.toLocaleString()}
          </div>
          <div className="text-sm font-semibold text-[#8E8E93] mt-1">
            {calorieDelta > 0
              ? `${calorieDelta.toLocaleString()} kcal remaining for surplus`
              : `+${Math.abs(calorieDelta).toLocaleString()} kcal beyond target`}
          </div>
        </div>

        {/* Horizontal Apple Health Activity Bar Gauge */}
        <div className="w-full h-3 rounded-full bg-[#2C2C2E] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#FF9500] to-[#FFD60A] transition-all duration-500"
            style={{ width: `${caloriePercent}%` }}
          />
        </div>

        {/* Macro Breakdown Bar Chips (HealthKit Colors) */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#2C2C2E]">
          {/* Protein: Hot Pink */}
          <div className="p-3 rounded-2xl bg-[#2C2C2E]/70 text-center">
            <span className="text-[10px] font-semibold text-[#FF2D55] uppercase tracking-wider block">
              Protein
            </span>
            <div className="text-lg font-bold text-white mt-0.5 font-mono">
              {totalProtein}g
            </div>
            <div className="text-[10px] text-[#8E8E93]">Goal: {targetProtein}g</div>
          </div>

          {/* Carbs: Apple Green */}
          <div className="p-3 rounded-2xl bg-[#2C2C2E]/70 text-center">
            <span className="text-[10px] font-semibold text-[#30D158] uppercase tracking-wider block">
              Carbs
            </span>
            <div className="text-lg font-bold text-white mt-0.5 font-mono">
              {totalCarbs}g
            </div>
            <div className="text-[10px] text-[#8E8E93]">Goal: {targetCarbs}g</div>
          </div>

          {/* Fat: Electric Blue */}
          <div className="p-3 rounded-2xl bg-[#2C2C2E]/70 text-center">
            <span className="text-[10px] font-semibold text-[#0A84FF] uppercase tracking-wider block">
              Fat
            </span>
            <div className="text-lg font-bold text-white mt-0.5 font-mono">
              {totalFat}g
            </div>
            <div className="text-[10px] text-[#8E8E93]">Goal: {targetFat}g</div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          QUICK-ACTION LOGGING BUTTONS (iOS Styled Rounded Pills)
          ========================================================================= */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block px-1">
          Quick Fuel Dials
        </span>
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => handleQuickAdd("Quick Snack", 250, 10, 35, 8)}
            className="px-4 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-xs font-semibold text-white whitespace-nowrap active:scale-95 transition-all shadow-sm"
          >
            +250 kcal
          </button>
          <button
            onClick={() => handleQuickAdd("Mass Refuel", 500, 35, 65, 12)}
            className="px-4 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-xs font-semibold text-white whitespace-nowrap active:scale-95 transition-all shadow-sm"
          >
            +500 kcal
          </button>
          <button
            onClick={() => handleQuickAdd("Whey Protein Shake", 160, 35, 3, 2, "post_workout")}
            className="px-4 py-2 rounded-full bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-[#2C2C2E] text-xs font-semibold text-[#FF2D55] whitespace-nowrap active:scale-95 transition-all shadow-sm"
          >
            +35g Whey Shake
          </button>
          <button
            onClick={() => setIsLogModalOpen(true)}
            className="px-4 py-2 rounded-full bg-[#FF9500]/20 border border-[#FF9500]/40 text-xs font-semibold text-[#FF9500] whitespace-nowrap active:scale-95 transition-all shadow-sm flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Meal</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          APPLE HEALTH GROUPED TABLE VIEWS (Breakfast, Lunch, Dinner, Post-Workout)
          ========================================================================= */}
      <div className="space-y-4">
        <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider block px-1">
          Logged Meals Today
        </span>

        {MEAL_CATEGORIES.map(({ type, label, icon: Icon }) => {
          const categoryMeals = meals.filter((m) => m.mealType === type);
          const categoryCalories = categoryMeals.reduce((s, m) => s + m.calories, 0);

          return (
            <div
              key={type}
              className="rounded-[20px] bg-[#1C1C1E] border border-[#2C2C2E]/60 overflow-hidden shadow-md divide-y divide-[#2C2C2E]"
            >
              {/* Category Header Row */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-7 h-7 rounded-lg bg-[#2C2C2E] text-[#8E8E93] flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-white">{label}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-semibold text-[#8E8E93]">
                    {categoryCalories > 0 ? `${categoryCalories} kcal` : "None"}
                  </span>
                  <button
                    onClick={() => {
                      setMealType(type);
                      setIsLogModalOpen(true);
                    }}
                    className="p-1 text-[#0A84FF] hover:bg-[#2C2C2E] rounded-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items in this category */}
              {categoryMeals.length > 0 ? (
                categoryMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="p-4 pl-14 flex items-center justify-between text-xs hover:bg-[#2C2C2E]/40 transition-colors"
                  >
                    <div>
                      <div className="font-semibold text-white">{meal.name}</div>
                      <div className="text-[11px] text-[#8E8E93] font-mono mt-0.5">
                        {meal.proteinG}g Protein • {meal.carbG}g Carbs • {meal.fatG}g Fat
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="font-bold font-mono text-white text-xs">
                        {meal.calories} kcal
                      </span>
                      <button
                        onClick={() => handleDeleteMeal(meal.id)}
                        className="text-[#8E8E93] hover:text-[#FF2D55] transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 pl-14 text-xs text-[#8E8E93]/60 italic font-mono">
                  No {label.toLowerCase()} entries yet
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          LOG MEAL ACTION SHEET MODAL
          ========================================================================= */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-lg rounded-t-[28px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] p-6 shadow-2xl space-y-4 animate-slide-up pb-safe">
            <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto -mt-2 mb-2" />

            <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-[#FF9500]/20 text-[#FF9500] flex items-center justify-center">
                  <Flame className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">Log Meal Intake</h3>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1">Meal Title</label>
                <input
                  type="text"
                  placeholder="e.g. Grilled Chicken & Rice"
                  value={mealName}
                  onChange={(e) => setMealName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#2C2C2E] border border-[#38383A] text-sm text-white focus:outline-none focus:border-[#FF9500]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1">Category</label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {MEAL_CATEGORIES.map(({ type, label }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                        mealType === type
                          ? "bg-[#FF9500] text-black shadow-md shadow-[#FF9500]/20 font-bold"
                          : "bg-[#2C2C2E] text-[#8E8E93] hover:text-white"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Macro Inputs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-3 rounded-xl bg-[#2C2C2E] border border-[#38383A]">
                  <label className="text-[10px] font-mono text-[#FF9500] uppercase block">Calories</label>
                  <input
                    type="number"
                    value={calories}
                    onChange={(e) => setCalories(Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-bold font-mono text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8E8E93]">kcal</span>
                </div>

                <div className="p-3 rounded-xl bg-[#2C2C2E] border border-[#38383A]">
                  <label className="text-[10px] font-mono text-[#FF2D55] uppercase block">Protein</label>
                  <input
                    type="number"
                    value={proteinG}
                    onChange={(e) => setProteinG(Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-bold font-mono text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8E8E93]">grams</span>
                </div>

                <div className="p-3 rounded-xl bg-[#2C2C2E] border border-[#38383A]">
                  <label className="text-[10px] font-mono text-[#30D158] uppercase block">Carbs</label>
                  <input
                    type="number"
                    value={carbG}
                    onChange={(e) => setCarbG(Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-bold font-mono text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8E8E93]">grams</span>
                </div>

                <div className="p-3 rounded-xl bg-[#2C2C2E] border border-[#38383A]">
                  <label className="text-[10px] font-mono text-[#0A84FF] uppercase block">Fat</label>
                  <input
                    type="number"
                    value={fatG}
                    onChange={(e) => setFatG(Number(e.target.value))}
                    className="w-full bg-transparent text-lg font-bold font-mono text-white focus:outline-none"
                  />
                  <span className="text-[10px] text-[#8E8E93]">grams</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#2C2C2E]">
              <button
                type="button"
                onClick={() => setIsLogModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8E8E93] hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMeal}
                className="px-6 py-2.5 rounded-xl bg-[#FF9500] text-black font-extrabold text-xs shadow-lg shadow-[#FF9500]/20 active:scale-95 transition-all"
              >
                Log to HealthKit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
